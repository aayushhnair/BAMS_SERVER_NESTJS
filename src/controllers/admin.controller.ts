import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';
import { Device, DeviceDocument } from '../schemas/device.schema';
import { Company, CompanyDocument } from '../schemas/company.schema';
import { AssignDeviceDto } from '../dto/admin.dto';

@Controller('api/admin')
export class AdminController {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Device.name) private deviceModel: Model<DeviceDocument>,
    @InjectModel(Company.name) private companyModel: Model<CompanyDocument>,
  ) {}

  @Post('assign-device')
  async assignDevice(@Body() assignDeviceDto: AssignDeviceDto) {
    try {
      // Check if device exists
      const device = await this.deviceModel.findOne({ deviceId: assignDeviceDto.deviceId });
      if (!device) {
        throw new HttpException('Device not found', HttpStatus.NOT_FOUND);
      }

      // Check if user exists
      const user = await this.userModel.findById(assignDeviceDto.userId);
      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      // Validate that user and device belong to the same company
      if (user.companyId !== device.companyId) {
        throw new HttpException('User and device must belong to the same company', HttpStatus.BAD_REQUEST);
      }

      // Validate company exists
      const company = await this.companyModel.findById(user.companyId);
      if (!company) {
        throw new HttpException('Company not found', HttpStatus.NOT_FOUND);
      }

      // Check if device is already assigned to another user
      const currentAssignedUser = await this.userModel.findOne({ 
        assignedDeviceId: assignDeviceDto.deviceId 
      });

      if (currentAssignedUser && String(currentAssignedUser._id) !== assignDeviceDto.userId) {
        // Unassign from current user
        await this.userModel.updateOne(
          { _id: currentAssignedUser._id },
          { $unset: { assignedDeviceId: 1 } }
        );
      }

      // Assign device to new user
      await this.userModel.updateOne(
        { _id: assignDeviceDto.userId },
        { assignedDeviceId: assignDeviceDto.deviceId }
      );

      // Update device assignment
      await this.deviceModel.updateOne(
        { deviceId: assignDeviceDto.deviceId },
        { assignedTo: assignDeviceDto.userId }
      );

      return {
        ok: true,
        message: 'Device assigned successfully',
        deviceId: assignDeviceDto.deviceId,
        userId: assignDeviceDto.userId,
        companyId: user.companyId
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Failed to assign device', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}