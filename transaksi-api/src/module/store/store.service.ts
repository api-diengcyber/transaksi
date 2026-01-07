import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { InstallStoreDto } from './dto/install-store.dto';
import { StoreEntity } from 'src/common/entities/store/store.entity';
import { StoreSettingEntity } from 'src/common/entities/store_setting/store_setting.entity';
import { UserEntity } from 'src/common/entities/user/user.entity';
import { AuthService } from 'src/module/auth/auth.service';
import { SaveSettingDto } from './dto/save-setting.dto';
import { UserRoleEntity, UserRole } from 'src/common/entities/user_role/user_role.entity';
import { CategoryService } from '../category/category.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { CreateBranchDto } from './dto/create-branch.dto';
import { ProductShelveEntity, ShelveType } from 'src/common/entities/product_shelve/product_shelve.entity';
import { generateStoreUuid, generateUserUuid, generateUserRoleUuid, generateStoreSettingUuid, generateShelveUuid } from 'src/common/utils/generate_uuid_util';

@Injectable()
export class StoreService {
  constructor(
    @Inject('STORE_REPOSITORY')
    private storeRepository: Repository<StoreEntity>,
    @Inject('STORE_SETTING_REPOSITORY')
    private storeSettingRepository: Repository<StoreSettingEntity>,
    @Inject('USER_REPOSITORY')
    private userRepository: Repository<UserEntity>,
    @Inject('DATA_SOURCE') private readonly dataSource: DataSource,
    private readonly authService: AuthService,
    private readonly categoryService: CategoryService,
  ) { }

  async installStore(dto: InstallStoreDto, logoPath: string | null = null, originalName: string | null = null) {
    const customStoreUuid = generateStoreUuid();
    const customUserUuid = generateUserUuid(customStoreUuid);

    return await this.dataSource.transaction(async (manager) => {
      // 0. PREPARE ALL ROLES (Menjamin semua role di enum ada di database)

      const allRoles = Object.values(UserRole);
      let adminUserRole: UserRoleEntity | null = null;

      for (const roleValue of allRoles) {
        let roleEntity = await manager.findOne(UserRoleEntity, {
          where: { role: roleValue },
        });

        if (!roleEntity) {
          roleEntity = manager.create(UserRoleEntity, {
            uuid: generateUserRoleUuid(customStoreUuid),
            role: roleValue,
          });
          await manager.save(roleEntity);
        }

        if (roleValue === UserRole.ADMIN) {
          adminUserRole = roleEntity; // Simpan role ADMIN untuk user pertama
        }
      }

      // Pastikan role admin ditemukan/terbuat
      if (!adminUserRole) {
        throw new Error('Admin role preparation failed.');
      }

      // 1. CREATE USER
      const hashedPassword = await bcrypt.hash(dto.password, 10);
      const newUser = manager.create(UserEntity, {
        uuid: customUserUuid,
        username: dto.username,
        password: hashedPassword,
        email: dto.email,
        roles: [adminUserRole]
      });
      const savedUser = await manager.save(newUser);

      // 2. CREATE STORE
      const newStore = manager.create(StoreEntity, {
        uuid: customStoreUuid,
        name: dto.name,
        address: dto.address,
        phone: dto.phone,
        createdBy: savedUser.uuid,
      });
      const savedStore = await manager.save(newStore);

      // 3. LINK USER KE STORE
      savedUser.defaultStore = savedStore;
      savedUser.stores = [savedStore];
      await manager.save(savedUser);

      // 4. INITIALIZE RESTAURANT CATEGORIES
      await this.categoryService.initializeRestaurantCategories(savedUser.uuid, savedStore.uuid, manager);

      // 5. SETTINGS
      if (dto.settings && dto.settings.length > 0) {
        const settingEntities = dto.settings.map((s) =>
          manager.create(StoreSettingEntity, {
            uuid: generateStoreSettingUuid(customStoreUuid),
            storeUuid: savedStore.uuid,
            key: s.key,
            value: s.value,
            createdBy: savedUser.uuid,
          }),
        );
        await manager.save(settingEntities);
      }

      const initialSettings: Partial<StoreSettingEntity>[] = [];

      if (logoPath) {
        initialSettings.push(manager.create(StoreSettingEntity, {
          uuid: generateStoreSettingUuid(customStoreUuid),
          storeUuid: savedStore.uuid,
          key: 'store_logo_url',
          value: logoPath,
        }));
        initialSettings.push(manager.create(StoreSettingEntity, {
          uuid: generateStoreSettingUuid(customStoreUuid),
          storeUuid: savedStore.uuid,
          key: 'store_logo_filename',
          value: originalName ?? '',
        }));
        initialSettings.push(manager.create(StoreSettingEntity, {
          uuid: generateStoreSettingUuid(customStoreUuid),
          storeUuid: savedStore.uuid,
          key: 'theme_primary_color',
          value: '#2563eb',
          createdBy: savedUser.uuid,
        }));
      }

      await manager.save(initialSettings);

      // 6. TOKEN (Bawa storeUuid)
      const tokens = await this.authService.getTokens(savedUser.uuid, savedUser.username);
      const rtHash = await bcrypt.hash(tokens.refreshToken, 10);
      savedUser.refreshToken = rtHash;
      await manager.save(savedUser);

      // 7. CREATE DEFAULT WAREHOUSE (Gudang Utama)
      const defaultShelve = manager.create(ProductShelveEntity, {
        uuid: generateShelveUuid(savedStore.uuid),
        storeUuid: savedStore.uuid,
        name: 'Gudang Utama',
        type: ShelveType.WAREHOUSE, 
        isDefault: true, 
        description: 'Penyimpanan Utama Toko',
        capacity: 999999,
        createdBy: savedUser.uuid,
      });
      await manager.save(defaultShelve);

      return {
        store: { ...savedStore, isActive: true },
        user: { username: savedUser.username, uuid: savedUser.uuid },
        tokens: tokens
      };
    });
  }

  // [UPDATED] 2. GET MY STORES (LIST + ACTIVE STATUS BY TOKEN)
  async getMyStores(userId: string, activeStoreUuid: string | null) {
    const userRepo = this.dataSource.getRepository(UserEntity);

    // Ambil User beserta semua tokonya
    const user = await userRepo.findOne({
      where: { uuid: userId },
      relations: [
        'stores',
        'stores.settings',
        'stores.branches',
        'stores.branches.settings',
        'stores.parentStore',
        'stores.parentStore.settings',
      ],
    });

    if (!user) throw new NotFoundException('User not found');

    // Mapping List Toko menjadi Satu Array Flat
    return user.stores.map((store) => {
      // 1. Format settings
      const formattedSettings: Record<string, string> = {};
      if (store.settings) {
        store.settings.forEach((s) => {
          formattedSettings[s.key] = s.value;
        });
      }

      // 2. Cek active store
      const isActive = store.uuid === activeStoreUuid;

      // 3. [LOGIC BARU] Tentukan Status (Pusat/Cabang) & Keterangan
      // Jika memiliki parentStore, berarti ini adalah Cabang
      const isBranch = !!store.parentStore;

      // Label sederhana: 'Pusat' atau 'Cabang'
      const storeType = isBranch ? 'CABANG' : 'PUSAT';

      // Keterangan lebih detail: 'Cabang dari [Nama Induk]'
      const description = isBranch
        ? `Cabang dari ${store.parentStore.name}`
        : 'Pusat Operasional';

      return {
        uuid: store.uuid,
        name: store.name,
        address: store.address,
        phone: store.phone,
        settings: formattedSettings,
        isActive: isActive,

        // Info Tambahan untuk Frontend
        storeType: storeType,       // 'PUSAT' | 'CABANG'
        description: description,   // Text deskripsi
        parentId: store.parentStore?.uuid || null, // UUID Parent jika butuh grouping

        // Tetap sertakan branches jika frontend butuh info anaknya siapa saja
        // Tapi struktur utamanya tetap array flat (satu level)
        branches: store.branches || []
      };
    });
  }

  async saveSettings(userId: string, storeUuid: string, dto: SaveSettingDto) {
    if (!storeUuid) throw new BadRequestException('Active Store ID not found in token');

    return await this.dataSource.transaction(async (manager) => {
      // 1. Cek Keberadaan Toko
      const store = await manager.findOne(StoreEntity, { where: { uuid: storeUuid } });
      if (!store) throw new NotFoundException('Store not found');

      // 2. Update Profil Toko (Root Fields)
      // Hanya update jika field dikirim di DTO
      if (dto.name) store.name = dto.name;
      if (dto.address) store.address = dto.address;
      if (dto.phone) store.phone = dto.phone;

      store.updatedBy = userId;
      await manager.save(store);

      // 3. Update Settings (Key-Value)
      if (dto.settings && dto.settings.length > 0) {
        for (const item of dto.settings) {
          // Cari apakah setting key ini sudah ada di toko ini?
          const existingSetting = await manager.findOne(StoreSettingEntity, {
            where: {
              storeUuid: storeUuid,
              key: item.key,
            },
          });

          if (existingSetting) {
            // UPDATE existing
            existingSetting.value = item.value;
            existingSetting.updatedBy = userId;
            await manager.save(existingSetting);
          } else {
            // CREATE new
            const newSetting = manager.create(StoreSettingEntity, {
              uuid: generateStoreSettingUuid(storeUuid),
              storeUuid: storeUuid,
              key: item.key,
              value: item.value,
              createdBy: userId,
            });
            await manager.save(newSetting);
          }
        }
      }

      return { message: 'Settings updated successfully' };
    });
  }

  async updateStoreLogo(storeUuid: string, logoUrl: string, originalName: string) {
    const key = 'store_logo_url';

    const existingSetting = await this.storeSettingRepository.findOne({
      where: { storeUuid, key: key }
    });

    if (existingSetting) {
      existingSetting.value = logoUrl;
      await this.storeSettingRepository.save(existingSetting);
    } else {
      const newSetting = this.storeSettingRepository.create({
        uuid: generateStoreSettingUuid(storeUuid),
        storeUuid,
        key: key,
        value: logoUrl,
      });
      await this.storeSettingRepository.save(newSetting);
    }

    const existingFileName = await this.storeSettingRepository.findOne({
      where: { storeUuid, key: 'store_logo_filename' }
    });
    if (existingFileName) {
      existingFileName.value = originalName;
      await this.storeSettingRepository.save(existingFileName);
    } else {
      await this.storeSettingRepository.save(this.storeSettingRepository.create({
        uuid: generateStoreSettingUuid(storeUuid),
        storeUuid,
        key: 'store_logo_filename',
        value: originalName,
      }));
    }

    return { message: 'Logo updated successfully', logoUrl };
  }

  async createStore(userId: string, dto: CreateStoreDto) {
    const newStore = this.storeRepository.create({
      uuid: generateStoreUuid(),
      name: dto.name,
      address: dto.address,
      phone: dto.phone,
    });

    const savedStore = await this.storeRepository.save(newStore);

    const user = await this.userRepository.findOne({
      where: { uuid: userId },
      relations: ['stores'],
    });

    if (user) {
      if (!user.stores) {
        user.stores = [];
      }
      user.stores.push(savedStore);
      await this.userRepository.save(user);
    }

    return savedStore;
  }

  async createBranch(ownerId: string, currentContextStoreUuid: string, dto: CreateBranchDto) {
    const branchStoreUuid = generateStoreUuid();
    const branchUserUuid = generateUserUuid(branchStoreUuid);

    // Tentukan Parent: Jika dikirim di DTO gunakan itu, jika tidak gunakan current context
    const targetParentUuid = dto.parentStoreUuid || currentContextStoreUuid;

    return await this.dataSource.transaction(async (manager) => {
      // 1. Validasi Parent Store (Target)
      const parentStore = await manager.findOne(StoreEntity, {
        where: { uuid: targetParentUuid }
      });
      if (!parentStore) throw new NotFoundException('Parent store not found');

      // 2. Ambil Role ADMIN
      const adminRole = await manager.findOne(UserRoleEntity, {
        where: { role: UserRole.ADMIN },
      });
      if (!adminRole) throw new BadRequestException('System role ADMIN not found');

      // 3. Validasi Username/Email Unik
      const existingUser = await manager.findOne(UserEntity, {
        where: [{ username: dto.username }, { email: dto.email }]
      });
      if (existingUser) throw new BadRequestException('Username or Email already exists');

      // 4. Create User Admin Cabang
      const hashedPassword = await bcrypt.hash(dto.password, 10);
      const newAdmin = manager.create(UserEntity, {
        uuid: branchUserUuid,
        username: dto.username,
        email: dto.email,
        password: hashedPassword,
        roles: [adminRole],
        createdBy: ownerId,
      });
      const savedUser = await manager.save(newAdmin);

      // 5. Create Store (Cabang) Linked ke Target Parent
      const newBranch = manager.create(StoreEntity, {
        uuid: branchStoreUuid,
        name: dto.name,
        address: dto.address,
        phone: dto.phone,
        parentStoreUuid: targetParentUuid, // [DYNAMIC LINK]
        createdBy: ownerId,
      });
      const savedBranch = await manager.save(newBranch);

      // 6. Link User ke Store
      savedUser.defaultStore = savedBranch;
      savedUser.stores = [savedBranch];
      await manager.save(savedUser);

      // 7. Init Categories
      await this.categoryService.initializeRestaurantCategories(savedUser.uuid, savedBranch.uuid, manager);

      // 8. Copy Theme
      const parentTheme = await manager.findOne(StoreSettingEntity, {
        where: { storeUuid: targetParentUuid, key: 'theme_primary_color' }
      });

      if (parentTheme) {
        await manager.save(manager.create(StoreSettingEntity, {
          uuid: generateStoreSettingUuid(branchStoreUuid),
          storeUuid: savedBranch.uuid,
          key: 'theme_primary_color',
          value: parentTheme.value,
          createdBy: savedUser.uuid
        }));
      }

      return {
        message: 'Branch created successfully',
        branch: savedBranch,
        parent: parentStore.name
      };
    });
  }

  async getBranchTree(rootStoreUuid: string) {
    // Mengambil toko root beserta anak-anaknya secara rekursif
    // TypeORM `relations` dengan depth tertentu atau menggunakan query builder

    // Cara simpel: Load relation nested (Max depth 5 misal)
    const tree = await this.storeRepository.findOne({
      where: { uuid: rootStoreUuid },
      relations: [
        'branches',
        'branches.branches',
        'branches.branches.branches'
      ],
      order: {
        createdAt: 'DESC'
      }
    });

    if (!tree) return [];

    // Format menjadi struktur yang mudah dikonsumsi frontend (Flat / Tree)
    // Disini kita return object Tree langsung
    return tree.branches || [];
  }
}