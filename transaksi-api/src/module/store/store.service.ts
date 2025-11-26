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

// [BARU] Helper untuk menghasilkan pengenal lokal
const generateLocalUuid = () => Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
// [BARU] Helper untuk menghasilkan Store UUID (STR-[local_identifier])
const generateStoreUuid = () => `STR-${generateLocalUuid()}`;
// [BARU] Helper untuk menghasilkan User UUID (prefix dengan Store UUID)
const generateUserUuid = (storeUuid: string) => `${storeUuid}-USR-${generateLocalUuid()}`;
// [BARU] Helper untuk menghasilkan Store Setting UUID (prefix dengan Store UUID)
const generateStoreSettingUuid = (storeUuid: string) => `${storeUuid}-STG-${generateLocalUuid()}`;
const generateUserRoleUuid = (storeUuid: string) => `${storeUuid}-ROLE-${generateLocalUuid()}`;

@Injectable()
export class StoreService {
  constructor(
    @Inject('STORE_SETTING_REPOSITORY')
    private settingRepository: Repository<StoreSettingEntity>,
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
      const tokens = await this.authService.getTokens(savedUser.uuid, savedUser.username, savedStore.uuid);
      const rtHash = await bcrypt.hash(tokens.refreshToken, 10);
      savedUser.refreshToken = rtHash;
      await manager.save(savedUser);

      return {
        store: { ...savedStore, isActive: true },
        user: { username: savedUser.username, uuid: savedUser.uuid },
        tokens: tokens
      };
    });
  }

  // [UPDATED] 2. GET MY STORES (LIST + ACTIVE STATUS BY TOKEN)
  async getMyStores(userId: string, activeStoreUuid: string) {
    const userRepo = this.dataSource.getRepository(UserEntity);

    // Ambil User beserta semua tokonya
    const user = await userRepo.findOne({
      where: { uuid: userId },
      relations: ['stores', 'stores.settings'], // Load settings untuk setiap toko
    });

    if (!user) throw new NotFoundException('User not found');

    // Mapping List Toko
    return user.stores.map((store) => {
      // Format settings
      const formattedSettings: Record<string, string> = {};
      if (store.settings) {
        store.settings.forEach((s) => {
          formattedSettings[s.key] = s.value;
        });
      }

      // [LOGIC BARU] Cek active berdasarkan Token JWT, bukan database defaultStore
      const isActive = store.uuid === activeStoreUuid;

      return {
        uuid: store.uuid,
        name: store.name,
        address: store.address,
        phone: store.phone,
        settings: formattedSettings,
        isActive: isActive,
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
    
    const existingSetting = await this.settingRepository.findOne({
      where: { storeUuid, key: key }
    });

    if (existingSetting) {
      existingSetting.value = logoUrl;
      await this.settingRepository.save(existingSetting);
    } else {
      const newSetting = this.settingRepository.create({
        uuid: generateStoreSettingUuid(storeUuid),
        storeUuid,
        key: key,
        value: logoUrl,
      });
      await this.settingRepository.save(newSetting);
    }
    
    const existingFileName = await this.settingRepository.findOne({
        where: { storeUuid, key: 'store_logo_filename' }
    });
    if (existingFileName) {
        existingFileName.value = originalName;
        await this.settingRepository.save(existingFileName);
    } else {
        await this.settingRepository.save(this.settingRepository.create({
            uuid: generateStoreSettingUuid(storeUuid),
            storeUuid,
            key: 'store_logo_filename',
            value: originalName,
        }));
    }

    return { message: 'Logo updated successfully', logoUrl };
  }
}