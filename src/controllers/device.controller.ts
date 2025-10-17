import { Controller, Post, Body, HttpException, HttpStatus, Get, Delete, Query, Param } from '@nestjs/common';
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
            companyName: company.name,
            message: 'Device registered successfully'
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Failed to register device', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get()
  async getDevices(@Query('companyId') companyId?: string) {
    try {
      const filter = companyId ? { companyId } : {};
      const devices = await this.deviceModel.find(filter);
      // Get company names for each device
      const companyIds = [...new Set(devices.map(d => d.companyId))];
      const companies = await this.companyModel.find({ _id: { $in: companyIds } });
      const companyMap = new Map(companies.map(c => [String(c._id), c.name]));
      return {
        ok: true,
        devices: devices.map(device => ({
          id: device._id,
          deviceId: device.deviceId,
          serial: device.serial,
          name: device.name,
          companyId: device.companyId,
          companyName: companyMap.get(device.companyId) || 'Unknown',
          lastSeen: device.lastSeen
        }))
      };
    } catch (error) {
      throw new HttpException('Failed to fetch devices', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete(':id')
  async deleteDevice(@Param('id') id: string) {
    try {
      const device = await this.deviceModel.findById(id);
      if (!device) {
        throw new HttpException('Device not found', HttpStatus.NOT_FOUND);
      }
      await device.deleteOne();
      return {
        ok: true,
        message: 'Device deleted successfully'
      };
    } catch (error) {
      throw new HttpException('Failed to delete device', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}

