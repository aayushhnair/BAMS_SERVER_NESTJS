import { Controller, Post, Get, Put, Delete, Body, Param, Query, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';
import { Device, DeviceDocument } from '../schemas/device.schema';
import { Location, LocationDocument } from '../schemas/location.schema';
import { Company, CompanyDocument } from '../schemas/company.schema';
import { CreateUserDto, UpdateUserDto } from '../dto/user.dto';
import { PasswordService } from '../services/password.service';

@Controller('api/users')
export class UsersController {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Device.name) private deviceModel: Model<DeviceDocument>,
    @InjectModel(Location.name) private locationModel: Model<LocationDocument>,
    @InjectModel(Company.name) private companyModel: Model<CompanyDocument>,
    private passwordService: PasswordService,
  ) {}

  @Post()
  async createUser(@Body() createUserDto: CreateUserDto) {
    try {
      // First, validate that the company exists
      const company = await this.companyModel.findById(createUserDto.companyId);
      if (!company) {
        throw new HttpException('Company not found', HttpStatus.BAD_REQUEST);
      }

      // Validate password strength
      const passwordValidation = this.passwordService.validatePasswordStrength(createUserDto.password);
      if (!passwordValidation.isValid) {
        throw new HttpException(`Password requirements not met: ${passwordValidation.errors.join(', ')}`, HttpStatus.BAD_REQUEST);
      }

      // Check if user already exists
      const existingUser = await this.userModel.findOne({
        companyId: createUserDto.companyId,
        username: createUserDto.username
      });

      if (existingUser) {
        throw new HttpException('Username already exists in this company', HttpStatus.CONFLICT);
      }

      // If assignedDeviceId is provided, validate that the device exists and belongs to the same company
      if (createUserDto.assignedDeviceId) {
        const device = await this.deviceModel.findOne({ 
          deviceId: createUserDto.assignedDeviceId,
          companyId: createUserDto.companyId 
        });

        if (!device) {
          throw new HttpException('Device not found or does not belong to this company', HttpStatus.BAD_REQUEST);
        }

        // Check if device is already assigned to another user
        const deviceAssignedUser = await this.userModel.findOne({ 
          assignedDeviceId: createUserDto.assignedDeviceId,
          companyId: createUserDto.companyId 
        });

        if (deviceAssignedUser) {
          throw new HttpException(`Device ${createUserDto.assignedDeviceId} is already assigned to user ${deviceAssignedUser.username}`, HttpStatus.CONFLICT);
        }
      }

      // If allocatedLocationId is provided, validate that the location exists and belongs to the same company
      if (createUserDto.allocatedLocationId) {
        const location = await this.locationModel.findOne({ 
          _id: createUserDto.allocatedLocationId,
          companyId: createUserDto.companyId 
        });

        if (!location) {
          throw new HttpException('Location not found or does not belong to this company', HttpStatus.BAD_REQUEST);
        }
      }

      // Hash the password before saving
      const hashedPassword = await this.passwordService.hashPassword(createUserDto.password);

      // Create new user with hashed password
      const user = new this.userModel({
        ...createUserDto,
        password: hashedPassword
      });
      await user.save();

      // If device was assigned, update the device's assignedTo field
      if (createUserDto.assignedDeviceId) {
        await this.deviceModel.updateOne(
          { deviceId: createUserDto.assignedDeviceId },
          { assignedTo: user._id }
        );
      }

      // Return user without password
      const { password, ...userResponse } = user.toObject();

      return {
        ok: true,
        user: userResponse,
        message: 'User created successfully'
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Failed to create user', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get()
  async getUsers(@Query() query: any) {
    try {
      const filters: any = {};
      if (query.companyId) filters.companyId = query.companyId;
      if (query.role) filters.role = query.role;

      const users = await this.userModel.find(filters).select('-password');
      
      return {
        ok: true,
        users
      };
    } catch (error) {
      throw new HttpException('Failed to fetch users', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get(':id')
  async getUserById(@Param('id') id: string) {
    try {
      const user = await this.userModel.findById(id).select('-password');
      
      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      return {
        ok: true,
        user
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Failed to fetch user', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Put(':id')
  async updateUser(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    try {
      const user = await this.userModel.findById(id);
      
      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      // If updating password, validate strength and hash it
      if (updateUserDto.password) {
        const passwordValidation = this.passwordService.validatePasswordStrength(updateUserDto.password);
        if (!passwordValidation.isValid) {
          throw new HttpException(`Password requirements not met: ${passwordValidation.errors.join(', ')}`, HttpStatus.BAD_REQUEST);
        }
        updateUserDto.password = await this.passwordService.hashPassword(updateUserDto.password);
      }

      // If updating assignedDeviceId, validate that the device exists and belongs to the same company
      if (updateUserDto.assignedDeviceId) {
        const device = await this.deviceModel.findOne({ 
          deviceId: updateUserDto.assignedDeviceId,
          companyId: user.companyId 
        });

        if (!device) {
          throw new HttpException('Device not found or does not belong to this company', HttpStatus.BAD_REQUEST);
        }

        // Check if device is already assigned to another user (excluding current user)
        const deviceAssignedUser = await this.userModel.findOne({ 
          assignedDeviceId: updateUserDto.assignedDeviceId,
          companyId: user.companyId,
          _id: { $ne: id } // Exclude current user
        });

        if (deviceAssignedUser) {
          throw new HttpException(`Device ${updateUserDto.assignedDeviceId} is already assigned to user ${deviceAssignedUser.username}`, HttpStatus.CONFLICT);
        }

        // If user had a previous device, clear its assignment
        if (user.assignedDeviceId && user.assignedDeviceId !== updateUserDto.assignedDeviceId) {
          await this.deviceModel.updateOne(
            { deviceId: user.assignedDeviceId },
            { $unset: { assignedTo: 1 } }
          );
        }

        // Update new device assignment
        await this.deviceModel.updateOne(
          { deviceId: updateUserDto.assignedDeviceId },
          { assignedTo: id }
        );
      } else if (updateUserDto.assignedDeviceId === null || updateUserDto.assignedDeviceId === '') {
        // If explicitly removing device assignment
        if (user.assignedDeviceId) {
          await this.deviceModel.updateOne(
            { deviceId: user.assignedDeviceId },
            { $unset: { assignedTo: 1 } }
          );
        }
        updateUserDto.assignedDeviceId = undefined;
      }

      // If updating allocatedLocationId, validate that the location exists and belongs to the same company
      if (updateUserDto.allocatedLocationId) {
        const location = await this.locationModel.findOne({ 
          _id: updateUserDto.allocatedLocationId,
          companyId: user.companyId 
        });

        if (!location) {
          throw new HttpException('Location not found or does not belong to this company', HttpStatus.BAD_REQUEST);
        }
      } else if (updateUserDto.allocatedLocationId === null || updateUserDto.allocatedLocationId === '') {
        // If explicitly removing location assignment
        updateUserDto.allocatedLocationId = undefined;
      }

      // Update user fields
      Object.assign(user, updateUserDto);
      await user.save();

      // Return user without password
      const { password, ...userResponse } = user.toObject();

      return {
        ok: true,
        user: userResponse,
        message: 'User updated successfully'
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Failed to update user', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete(':id')
  async deleteUser(@Param('id') id: string) {
    try {
      const user = await this.userModel.findById(id);
      
      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      // If user had an assigned device, clear its assignment
      if (user.assignedDeviceId) {
        await this.deviceModel.updateOne(
          { deviceId: user.assignedDeviceId },
          { $unset: { assignedTo: 1 } }
        );
      }

      await this.userModel.findByIdAndDelete(id);

      return {
        ok: true,
        message: 'User deleted successfully'
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Failed to delete user', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('available-devices/:companyId')
  async getAvailableDevices(@Param('companyId') companyId: string) {
    try {
      // First validate that the company exists
      const company = await this.companyModel.findById(companyId);
      if (!company) {
        throw new HttpException('Company not found', HttpStatus.BAD_REQUEST);
      }

      // Find devices that belong to the company but are not assigned to any user
      const assignedDeviceIds = await this.userModel.find({ companyId }).distinct('assignedDeviceId');
      const availableDevices = await this.deviceModel.find({
        companyId,
        deviceId: { $nin: assignedDeviceIds }
      });

      return {
        ok: true,
        devices: availableDevices
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Failed to fetch available devices', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}