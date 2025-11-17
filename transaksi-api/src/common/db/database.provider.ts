
import { DataSource } from 'typeorm';

export const databaseProvider = [
  {
    provide: 'DATA_SOURCE',
    useFactory: async () => {
      const dataSource = new DataSource({
        type: 'mysql',
        host: 'localhost',
        port: 8889,
        username: 'root',
        password: 'root',
        database: 'transaksi',
        charset: 'utf8mb4',
        extra: {
          charset: 'utf8mb4',
          collation: 'utf8mb4_unicode_ci',
        },
        entities: [
          __dirname + '/../**/*.entity{.ts,.js}',
        ],
        synchronize: true,
      });

      return dataSource.initialize();
    },
  },
];
