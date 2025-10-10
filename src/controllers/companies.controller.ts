import { Controller, Post, Get, Put, Body, Param, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Company, CompanyDocument } from '../schemas/company.schema';
import { CreateCompanyDto, UpdateCompanyDto } from '../dto/company.dto';

@Controller('api/companies')
export class CompaniesController {
  constructor(
    @InjectModel(Company.name) private companyModel: Model<CompanyDocument>,
  ) {}

  @Post()
  async createCompany(@Body() createCompanyDto: CreateCompanyDto) {
    try {
      const company = new this.companyModel({
        name: createCompanyDto.name,
        timezone: createCompanyDto.timezone || 'Asia/Kolkata',
        settings: {
          sessionTimeoutHours: createCompanyDto.settings?.sessionTimeoutHours || 12,
          heartbeatMinutes: createCompanyDto.settings?.heartbeatMinutes || 5
        }
      });

      await company.save();

      return {
        ok: true,
        company: company,
        message: 'Company created successfully'
      };
    } catch (error) {
      throw new HttpException('Failed to create company', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get()
  async getCompanies() {
    try {
      const companies = await this.companyModel.find();

      return {
        ok: true,
        companies: companies
      };
    } catch (error) {
      throw new HttpException('Failed to fetch companies', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get(':id')
  async getCompanyById(@Param('id') id: string) {
    try {
      const company = await this.companyModel.findById(id);
      
      if (!company) {
        throw new HttpException('Company not found', HttpStatus.NOT_FOUND);
      }

      return {
        ok: true,
        company: company
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Failed to fetch company', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Put(':id')
  async updateCompany(@Param('id') id: string, @Body() updateCompanyDto: UpdateCompanyDto) {
    try {
      const company = await this.companyModel.findById(id);
      
      if (!company) {
        throw new HttpException('Company not found', HttpStatus.NOT_FOUND);
      }

      // Update company fields
      if (updateCompanyDto.name) company.name = updateCompanyDto.name;
      if (updateCompanyDto.timezone) company.timezone = updateCompanyDto.timezone;
      if (updateCompanyDto.settings) {
        company.settings = { ...company.settings, ...updateCompanyDto.settings };
      }

      await company.save();

      return {
        ok: true,
        company: company,
        message: 'Company updated successfully'
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Failed to update company', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}