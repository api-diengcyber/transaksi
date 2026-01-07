import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository, DataSource, In, EntityManager, Brackets } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserEntity } from 'src/common/entities/user/user.entity';
import { UserRoleEntity, UserRole } from 'src/common/entities/user_role/user_role.entity';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { StoreEntity } from 'src/common/entities/store/store.entity';
import { generateUserUuid } from 'src/common/utils/generate_uuid_util';

@Injectable()
export class UserService {
  constructor(
    @Inject('USER_REPOSITORY')
    private readonly userRepo: Repository<UserEntity>,
    @Inject('USER_ROLE_REPOSITORY')
    private readonly roleRepo: Repository<UserRoleEntity>,
    @Inject('STORE_REPOSITORY')
    private readonly storeRepo: Repository<StoreEntity>,
    @Inject('DATA_SOURCE')
    private readonly dataSource: DataSource,
  ) {}

  // ... (Create method tetap sama, pastikan storeUuid wajib) ...
  async create(dto: CreateUserDto, creatorId: string, storeUuid: string) {
    if (!storeUuid) throw new BadRequestException('Store ID is required.');
    
    // Cek username global (bisa disesuaikan jika ingin unique per store)
    const existingUser = await this.userRepo.findOne({ where: { username: dto.username } });
    if (existingUser) throw new BadRequestException('Username/No. HP sudah terdaftar.');
    
    return this.dataSource.transaction(async (manager: EntityManager) => {
        const hashedPassword = await bcrypt.hash(dto.password, 10);
        
        // Cari Role, jika tidak dikirim, default ke MEMBER (opsional logic)
        const roleNames = dto.roles && dto.roles.length > 0 ? dto.roles : [UserRole.MEMBER];
        const roles = await manager.findBy(UserRoleEntity, { role: In(roleNames) });
        
        if (roles.length === 0) throw new BadRequestException('Role tidak valid.');

        const currentStore = await manager.findOne(StoreEntity, { where: { uuid: storeUuid } });
        if (!currentStore) throw new NotFoundException('Store not found.');

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

  // [PERBAIKAN] Menambahkan fitur Search
  async findAll(storeUuid: string, role?: UserRole, search?: string) {
    const userRepo = this.dataSource.getRepository(UserEntity);
    
    let query = userRepo.createQueryBuilder('user')
        .leftJoinAndSelect('user.roles', 'roles')
        .leftJoin('user.stores', 'store')
        .where('store.uuid = :storeUuid', { storeUuid });

    if (role) {
      query = query.andWhere('roles.role = :role', { role });
    }

    if (search) {
      query = query.andWhere(new Brackets(qb => {
        qb.where('user.username LIKE :search', { search: `%${search}%` })
          .orWhere('user.email LIKE :search', { search: `%${search}%` });
      }));
    }

    return query
        .orderBy('user.createdAt', 'DESC')
        .select([
          'user.uuid', 
          'user.username', 
          'user.email', 
          'user.createdAt', 
          'roles.role'
        ])
        .getMany();
  }

  // ... (Method update, findOne, softDelete, updatePassword tetap sama) ...
  async findOne(uuid: string, storeUuid: string) {
      const user = await this.userRepo.createQueryBuilder('user')
        .leftJoinAndSelect('user.roles', 'roles')
        .leftJoin('user.stores', 'store')
        .where('user.uuid = :uuid', { uuid })
        .andWhere('store.uuid = :storeUuid', { storeUuid })
        .getOne();

      if (!user) throw new NotFoundException(`User tidak ditemukan.`);
      return user;
  }
  
  async update(uuid: string, dto: UpdateUserDto, updaterId: string, storeUuid: string) {
      return this.dataSource.transaction(async (manager: EntityManager) => {
          const user = await this.findOne(uuid, storeUuid);

          if (dto.username) user.username = dto.username;
          if (dto.email) user.email = dto.email;

          // Update Roles jika ada
          if (dto.roles && dto.roles.length > 0) {
              const roles = await manager.findBy(UserRoleEntity, { role: In(dto.roles) });
              user.roles = roles;
          }

          user.updatedBy = updaterId;
          return await manager.save(user);
      });
  }

  async softDelete(uuid: string, deleterId: string, storeUuid: string) {
      const user = await this.findOne(uuid, storeUuid); 
      user.deletedBy = deleterId;
      await this.userRepo.save(user);
      return this.userRepo.softDelete(uuid);
  }

  async findAllRoles() {
      return this.roleRepo.find();
  }
  
   async updatePassword(uuid: string, newPassword: string, updaterId: string, storeUuid: string) {
      const user = await this.findOne(uuid, storeUuid);
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;
      user.updatedBy = updaterId;
      return this.userRepo.save(user);
  }
}