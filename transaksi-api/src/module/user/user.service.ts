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

  async create(dto: CreateUserDto, creatorId: string, storeUuid: string) {
    if (!storeUuid) throw new BadRequestException('Store ID is required.');
    
    // 1. Cek ketersediaan username
    const existingUser = await this.userRepo.findOne({ where: { username: dto.username } });
    if (existingUser) throw new BadRequestException('Username/No. HP sudah terdaftar.');
    
    return this.dataSource.transaction(async (manager: EntityManager) => {
        const hashedPassword = await bcrypt.hash(dto.password, 10);
        
        // 2. Cari Role berdasarkan UUID (Karena dto.roles berisi UUID)
        // Kita mencari di kolom 'uuid' sesuai data yang dikirim frontend
        const roles = await manager.find(UserRoleEntity, { 
            where: { uuid: In(dto.roles) } 
        });
        
        if (roles.length === 0) {
            throw new BadRequestException('Role tidak ditemukan atau ID Role tidak valid.');
        }

        // 3. Cari Store
        const currentStore = await manager.findOne(StoreEntity, { where: { uuid: storeUuid } });
        if (!currentStore) throw new NotFoundException('Store not found.');

        // 4. Generate UUID User Baru
        const customUserUuid = generateUserUuid(storeUuid);

        // 5. Create Entity
        const newUser = manager.create(UserEntity, {
            uuid: customUserUuid,
            username: dto.username,
            email: dto.email,
            password: hashedPassword,
            roles: roles, // Berisi array entity role yang ditemukan
            defaultStore: currentStore,
            stores: [currentStore],
            createdBy: creatorId,
        });

        return await manager.save(newUser);
    });
  }

  // Perbaiki juga method update agar menggunakan UUID untuk pencarian role
  async update(uuid: string, dto: UpdateUserDto, updaterId: string, storeUuid: string) {
      return this.dataSource.transaction(async (manager: EntityManager) => {
          const user = await this.findOne(uuid, storeUuid);

          if (dto.username) user.username = dto.username;
          if (dto.email) user.email = dto.email;

          if (dto.roles && dto.roles.length > 0) {
              // Cari berdasarkan UUID
              const roles = await manager.find(UserRoleEntity, { 
                  where: { uuid: In(dto.roles) } 
              });
              if (roles.length > 0) user.roles = roles;
          }

          user.updatedBy = updaterId;
          return await manager.save(user);
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