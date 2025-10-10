import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Device, DeviceDocument } from '../schemas/device.schema';
import { Company, CompanyDocument } from '../schemas/company.schema';
import { RegisterDeviceDto } from '../dto/register-device.dto';

@Controller('api/device')
export class DeviceController {
  constructor(
    @InjectModel(Device.name) private deviceModel: Model<DeviceDocument>,
    @InjectModel(Company.name) private companyModel: Model<CompanyDocument>,
  ) {}

  @Post('register')
  async registerDevice(@Body() registerDeviceDto: RegisterDeviceDto) {
    try {
      // First, validate that the company exists
      const company = await this.companyModel.findById(registerDeviceDto.companyId);
      if (!company) {
        throw new HttpException('Company not found', HttpStatus.BAD_REQUEST);
      }

      // Check if device already exists
      const existingDevice = await this.deviceModel.findOne({
        deviceId: registerDeviceDto.deviceId
      });

      if (existingDevice) {
        throw new HttpException('Device already registered', HttpStatus.CONFLICT);
      }

      // Create new device
      const device = new this.deviceModel({
        deviceId: registerDeviceDto.deviceId,
        serial: registerDeviceDto.serial,
        name: registerDeviceDto.name,
        companyId: registerDeviceDto.companyId,
        lastSeen: new Date()
      });

      await device.save();

      return {
        ok: true,
        deviceId: device.deviceId,
        message: 'Device registered successfully'
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Failed to register device', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}