import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { InstallStoreDto } from './dto/install-store.dto';
import { StoreEntity } from 'src/common/entities/store/store.entity';
import { StoreSettingEntity } from 'src/common/entities/store_setting/store_setting.entity';
import { UserEntity } from 'src/common/entities/user/user.entity';
import { AuthService } from 'src/module/auth/auth.service';
import { SaveSettingDto } from './dto/save-setting.dto';
import { RoleEntity, Role } from 'src/common/entities/role/role.entity';

@Injectable()
export class StoreService {
  constructor(
    @Inject('DATA_SOURCE') private readonly dataSource: DataSource,
    private readonly authService: AuthService,
  ) {}

  async installStore(dto: InstallStoreDto) {
    return await this.dataSource.transaction(async (manager) => {
      // 0. PREPARE ROLE ADMIN
      let adminRole = await manager.findOne(RoleEntity, {
        where: { role: Role.ADMIN },
      });
      if (!adminRole) {
        adminRole = manager.create(RoleEntity, {
          role: Role.ADMIN,
        });
        await manager.save(adminRole);
      }

      // 1. CREATE USER
      const hashedPassword = await bcrypt.hash(dto.password, 10);
      const newUser = manager.create(UserEntity, {
        username: dto.username,
        password: hashedPassword,
        email: dto.email,
        roles: [adminRole]
      });
      const savedUser = await manager.save(newUser);

      // 2. CREATE STORE
      const newStore = manager.create(StoreEntity, {
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

      // 4. SETTINGS
      if (dto.settings && dto.settings.length > 0) {
        const settingEntities = dto.settings.map((s) =>
          manager.create(StoreSettingEntity, {
            storeUuid: savedStore.uuid,
            key: s.key,
            value: s.value,
            createdBy: savedUser.uuid,
          }),
        );
        await manager.save(settingEntities);
      }

      // 5. TOKEN (Bawa storeUuid)
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
}