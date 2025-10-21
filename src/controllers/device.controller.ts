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
      
      // Handle empty devices list
      if (devices.length === 0) {
        return {
          ok: true,
          count: 0,
          devices: [],
          message: 'No devices found'
        };
      }
      
      // Get company names for each device (filter out invalid/admin company IDs)
      const companyIds = [...new Set(devices.map(d => d.companyId))]
        .filter(id => id && id !== 'ADMIN-GLOBAL' && id.length === 24); // Valid MongoDB ObjectId is 24 chars
      
      let companyMap = new Map();
      
      if (companyIds.length > 0) {
        try {
          const companies = await this.companyModel.find({ _id: { $in: companyIds } });
          companyMap = new Map(companies.map(c => [String(c._id), c.name]));
        } catch (err) {
          console.error('Error fetching company names:', err);
          // Continue without company names if fetch fails
        }
      }
      
      return {
        ok: true,
        count: devices.length,
        devices: devices.map(device => ({
          id: device._id,
          deviceId: device.deviceId,
          serial: device.serial,
          name: device.name,
          companyId: device.companyId,
          companyName: device.companyId === 'ADMIN-GLOBAL' 
            ? 'Admin Device' 
            : (companyMap.get(device.companyId) || 'Unknown'),
          assignedTo: device.assignedTo || null,
          lastSeen: device.lastSeen,
          isAdminDevice: device.companyId === 'ADMIN-GLOBAL'
        }))
      };
    } catch (error) {
      console.error('Error fetching devices:', error);
      throw new HttpException({
        message: 'Failed to fetch devices. Please try again.',
        error: 'FETCH_DEVICES_FAILED',
        details: error.message
      }, HttpStatus.INTERNAL_SERVER_ERROR);
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

