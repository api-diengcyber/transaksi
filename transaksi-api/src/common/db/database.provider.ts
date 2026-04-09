import { DataSource } from 'typeorm';

export const databaseProvider = [
  {
    provide: 'DATA_SOURCE',
    useFactory: async () => {
      const dataSource = new DataSource({
        type: 'mysql',
        host: process.env.DATABASE_HOST || '127.0.0.1',       // <-- BACA DARI ENV
        port: parseInt(process.env.DATABASE_PORT || '8889', 10), // <-- BACA DARI ENV
        username: process.env.DATABASE_USER || 'root',        // <-- BACA DARI ENV
        password: process.env.DATABASE_PASSWORD || 'root',    // <-- BACA DARI ENV
        database: process.env.DATABASE_NAME || 'transaksi',   // <-- BACA DARI ENV
        charset: 'utf8mb4',
        extra: {
          charset: 'utf8mb4',
        },
        entities: [
          __dirname + '/../**/*.entity{.ts,.js}',
        ],
        synchronize: true,
        // synchronize: process.env.NODE_ENV !== 'production',
      });

      return dataSource.initialize();
    },
  },
];