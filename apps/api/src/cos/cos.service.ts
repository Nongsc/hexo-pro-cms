import { BadRequestException, Injectable } from '@nestjs/common';
import { SettingsService } from '../modules/settings/settings.service';
import { CosConfig } from '../config/types';
import COS = require('cos-nodejs-sdk-v5');

export interface CosObjectList {
  Contents?: any[];
  IsTruncated?: string;
  NextMarker?: string;
}

@Injectable()
export class CosService {
  constructor(private readonly settings: SettingsService) {}

  private async config(): Promise<CosConfig> {
    const cfg = await this.settings.getCosConfig();
    if (!cfg.secretId || !cfg.secretKey || !cfg.bucket || !cfg.region) {
      throw new BadRequestException(
        '请先在系统设置中配置腾讯云 COS（SecretId/SecretKey/Bucket/Region）',
      );
    }
    return cfg;
  }

  private async client() {
    const cfg = await this.config();
    return new COS({ SecretId: cfg.secretId, SecretKey: cfg.secretKey });
  }

  async urlFor(key: string): Promise<string> {
    const cfg = await this.config();
    const k = key
      .split('/')
      .map((s) => encodeURIComponent(s))
      .join('/');
    if (cfg.customDomain) return `${cfg.customDomain.replace(/\/+$/, '')}/${k}`;
    return `https://${cfg.bucket}.cos.${cfg.region}.myqcloud.com/${k}`;
  }

  async putObject(
    key: string,
    body: Buffer | string,
    contentType?: string,
  ): Promise<{ key: string; url: string }> {
    const cfg = await this.config();
    const cos = await this.client();
    await new Promise<void>((resolve, reject) => {
      cos.putObject(
        {
          Bucket: cfg.bucket,
          Region: cfg.region,
          Key: key,
          Body: body,
          ContentType: contentType,
        },
        (err: any) => (err ? reject(err) : resolve()),
      );
    });
    return { key, url: await this.urlFor(key) };
  }

  async presignPut(key: string, expires = 900): Promise<string> {
    const cfg = await this.config();
    const cos = await this.client();
    return new Promise<string>((resolve, reject) => {
      cos.getObjectUrl(
        {
          Bucket: cfg.bucket,
          Region: cfg.region,
          Key: key,
          Method: 'PUT',
          Sign: true,
          Expires: expires,
        },
        (err: any, data: { Url: string }) =>
          err ? reject(err) : resolve(data.Url),
      );
    });
  }

  async listObjects(prefix: string, marker?: string): Promise<CosObjectList> {
    const cfg = await this.config();
    const cos = await this.client();
    return new Promise<CosObjectList>((resolve, reject) => {
      cos.getBucket(
        {
          Bucket: cfg.bucket,
          Region: cfg.region,
          Prefix: prefix,
          Marker: marker,
          MaxKeys: 1000,
          Delimiter: '',
        },
        (err: any, data: CosObjectList) =>
          err ? reject(err) : resolve(data),
      );
    });
  }

  async deleteObject(key: string): Promise<void> {
    const cfg = await this.config();
    const cos = await this.client();
    await new Promise<void>((resolve, reject) => {
      cos.deleteObject(
        { Bucket: cfg.bucket, Region: cfg.region, Key: key },
        (err: any) => (err ? reject(err) : resolve()),
      );
    });
  }

  async copyObject(srcKey: string, dstKey: string): Promise<void> {
    const cfg = await this.config();
    const cos = await this.client();
    const encodedKey = srcKey
      .split('/')
      .map((s) => encodeURIComponent(s))
      .join('/');
    await new Promise<void>((resolve, reject) => {
      cos.putObjectCopy(
        {
          Bucket: cfg.bucket,
          Region: cfg.region,
          Key: dstKey,
          CopySource: `${cfg.bucket}.cos.${cfg.region}.myqcloud.com/${encodedKey}`,
        },
        (err: any) => (err ? reject(err) : resolve()),
      );
    });
  }

  async deleteMultiple(keys: string[]): Promise<void> {
    const cfg = await this.config();
    const cos = await this.client();
    await new Promise<void>((resolve, reject) => {
      cos.deleteMultipleObject(
        {
          Bucket: cfg.bucket,
          Region: cfg.region,
          Objects: keys.map((Key) => ({ Key })),
        },
        (err: any) => (err ? reject(err) : resolve()),
      );
    });
  }

  async headObject(key: string): Promise<any> {
    const cfg = await this.config();
    const cos = await this.client();
    return new Promise((resolve, reject) => {
      cos.headObject(
        { Bucket: cfg.bucket, Region: cfg.region, Key: key },
        (err: any, data: any) => (err ? reject(err) : resolve(data)),
      );
    });
  }
}
