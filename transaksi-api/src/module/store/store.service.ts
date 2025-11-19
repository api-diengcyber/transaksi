import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { InstallStoreDto } from './dto/install-store.dto';
import { StoreEntity } from 'src/common/entities/store/store.entity';
import { StoreSettingEntity } from 'src/common/entities/store_setting/store_setting.entity';
import { UserEntity } from 'src/common/entities/user/user.entity';
import { AuthService } from 'src/module/auth/auth.service';

@Injectable()
export class StoreService {
  constructor(
    @Inject('DATA_SOURCE') private readonly dataSource: DataSource,
    private readonly authService: AuthService,
  ) {}

  // ... installStore TETAP SAMA ...
  async installStore(dto: InstallStoreDto) {
    return await this.dataSource.transaction(async (manager) => {
      // 1. CREATE USER
      const hashedPassword = await bcrypt.hash(dto.password, 10);
      const newUser = manager.create(UserEntity, {
        username: dto.username,
        password: hashedPassword,
        email: dto.email,
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
}