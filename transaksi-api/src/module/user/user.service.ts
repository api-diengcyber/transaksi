// src/module/user/user.service.ts

import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository, DataSource, In, EntityManager } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserEntity } from 'src/common/entities/user/user.entity';
import { UserRoleEntity, UserRole } from 'src/common/entities/user_role/user_role.entity';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { StoreEntity } from 'src/common/entities/store/store.entity';

// Helper yang mirip dengan di store.service.ts
const generateLocalUuid = () => Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
const generateUserUuid = (storeUuid: string) => `${storeUuid}-USR-${generateLocalUuid()}`;

@Injectable()
export class UserService {
  constructor(
    @Inject('USER_REPOSITORY')
    private readonly userRepo: Repository<UserEntity>,
    @Inject('USER_ROLE_REPOSITORY')
    private readonly roleRepo: Repository<UserRoleEntity>,
    @Inject('STORE_REPOSITORY') // Diperlukan untuk validasi store default
    private readonly storeRepo: Repository<StoreEntity>,
    @Inject('DATA_SOURCE')
    private readonly dataSource: DataSource,
  ) {}

  // --- CRUD Operations ---

  async create(dto: CreateUserDto, creatorId: string, storeUuid: string) {
    if (!storeUuid) {
      throw new BadRequestException('Store ID is required for user creation.');
    }
    
    const existingUser = await this.userRepo.findOne({ where: { username: dto.username } });
    if (existingUser) {
        throw new BadRequestException('Username already exists.');
    }
    
    return this.dataSource.transaction(async (manager: EntityManager) => {
        const hashedPassword = await bcrypt.hash(dto.password, 10);
        const roles = await manager.findBy(UserRoleEntity, { role: In(dto.roles) });
        
        if (roles.length !== dto.roles.length) {
            throw new BadRequestException('One or more roles are invalid.');
        }

        const currentStore = await manager.findOne(StoreEntity, { where: { uuid: storeUuid } });
        if (!currentStore) {
             throw new NotFoundException('Active store not found.');
        }

        const customUserUuid = generateUserUuid(storeUuid);

        const newUser = manager.create(UserEntity, {
            uuid: customUserUuid,
            username: dto.username,
            email: dto.email,
            password: hashedPassword,
            roles: roles,
            defaultStore: currentStore,
            stores: [currentStore],
            createdBy: creatorId,
        });

        return await manager.save(newUser);
    });
  }

  async findAll(storeUuid: string) {
    // Mengambil semua pengguna yang terhubung ke toko ini
    const userRepo = this.dataSource.getRepository(UserEntity);
    return userRepo.createQueryBuilder('user')
        .leftJoinAndSelect('user.roles', 'roles')
        .leftJoin('user.stores', 'store')
        .where('store.uuid = :storeUuid', { storeUuid })
        .orderBy('user.createdAt', 'DESC')
        // Memilih kolom yang aman (tanpa password)
        .select(['user.uuid', 'user.username', 'user.email', 'user.createdAt', 'user.deletedAt', 'roles.uuid', 'roles.role'])
        .getMany();
  }
  
  async findOne(uuid: string, storeUuid: string) {
      // Memastikan pengguna milik toko yang sedang aktif
      const user = await this.userRepo.createQueryBuilder('user')
        .leftJoinAndSelect('user.roles', 'roles')
        .leftJoin('user.stores', 'store')
        .where('user.uuid = :uuid', { uuid })
        .andWhere('store.uuid = :storeUuid', { storeUuid })
        .getOne();

      if (!user) {
          throw new NotFoundException(`User with UUID ${uuid} not found in this store.`);
      }
      return user;
  }

  async update(uuid: string, dto: UpdateUserDto, updaterId: string, storeUuid: string) {
      return this.dataSource.transaction(async (manager: EntityManager) => {
          const user = await this.findOne(uuid, storeUuid);

          if (dto.username) user.username = dto.username;
          if (dto.email) user.email = dto.email;

          if (dto.roles && dto.roles.length > 0) {
              const roles = await manager.findBy(UserRoleEntity, { role: In(dto.roles) });
              if (roles.length !== dto.roles.length) {
                  throw new BadRequestException('One or more roles are invalid.');
              }
              user.roles = roles;
          }
          
          if (dto.defaultStoreUuid && dto.defaultStoreUuid !== user.defaultStoreUuid) {
              const newDefaultStore = await manager.findOne(StoreEntity, { where: { uuid: dto.defaultStoreUuid } });
              if (!newDefaultStore) {
                   throw new BadRequestException('New default store not found.');
              }
              user.defaultStore = newDefaultStore;
          }

          user.updatedBy = updaterId;
          return await manager.save(user);
      });
  }
  
  async updatePassword(uuid: string, newPassword: string, updaterId: string, storeUuid: string) {
      const user = await this.findOne(uuid, storeUuid);
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;
      user.updatedBy = updaterId;
      return this.userRepo.save(user);
  }

  async softDelete(uuid: string, deleterId: string, storeUuid: string) {
      const user = await this.findOne(uuid, storeUuid); 
      user.deletedBy = deleterId;
      await this.userRepo.save(user);
      return this.userRepo.softDelete(uuid);
  }
  
  // --- Role Retrieval ---
  
  async findAllRoles() {
      // Mengambil semua role yang ada di sistem
      return this.roleRepo.find();
  }
}