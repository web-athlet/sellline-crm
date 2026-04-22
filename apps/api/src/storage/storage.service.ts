import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { Client as MinioClient } from 'minio';

import { type AppConfigService } from '../config/config.service';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  readonly client: MinioClient;
  readonly bucket: string;

  constructor(config: AppConfigService) {
    this.client = new MinioClient({
      endPoint: config.get('MINIO_ENDPOINT'),
      port: config.get('MINIO_PORT'),
      useSSL: config.get('MINIO_USE_SSL'),
      accessKey: config.get('MINIO_ACCESS_KEY'),
      secretKey: config.get('MINIO_SECRET_KEY'),
    });
    this.bucket = config.get('MINIO_BUCKET');
  }

  async onModuleInit(): Promise<void> {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket);
        this.logger.log(`Bucket ${this.bucket} created`);
      }
    } catch (err) {
      this.logger.warn(`MinIO init skipped: ${(err as Error).message}`);
    }
  }

  presignedPut(objectName: string, expirySec = 3600): Promise<string> {
    return this.client.presignedPutObject(this.bucket, objectName, expirySec);
  }

  presignedGet(objectName: string, expirySec = 3600): Promise<string> {
    return this.client.presignedGetObject(this.bucket, objectName, expirySec);
  }
}
