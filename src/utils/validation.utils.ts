import { BadRequestException } from '@nestjs/common';

export class ValidationUtils {
  /**
   * Validate and sanitize string input
   */
  static validateString(value: any, fieldName: string, options: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
  } = {}): string {
    if (options.required && (!value || typeof value !== 'string' || value.trim().length === 0)) {
      throw new BadRequestException(`${fieldName} is required`);
    }

    if (!value) {
      return '';
    }

    if (typeof value !== 'string') {
      throw new BadRequestException(`${fieldName} must be a string`);
    }

    const trimmedValue = value.trim();

    if (options.minLength && trimmedValue.length < options.minLength) {
      throw new BadRequestException(`${fieldName} must be at least ${options.minLength} characters`);
    }

    if (options.maxLength && trimmedValue.length > options.maxLength) {
      throw new BadRequestException(`${fieldName} must not exceed ${options.maxLength} characters`);
    }

    if (options.pattern && !options.pattern.test(trimmedValue)) {
      throw new BadRequestException(`${fieldName} format is invalid`);
    }

    // Basic XSS prevention
    const sanitized = trimmedValue
      .replace(/[<>]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');

    return sanitized;
  }

  /**
   * Validate MongoDB ObjectId
   */
  static validateObjectId(value: any, fieldName: string, required: boolean = true): string {
    if (!value && required) {
      throw new BadRequestException(`${fieldName} is required`);
    }

    if (!value) {
      return '';
    }

    if (typeof value !== 'string') {
      throw new BadRequestException(`${fieldName} must be a string`);
    }

    const objectIdPattern = /^[0-9a-fA-F]{24}$/;
    if (!objectIdPattern.test(value)) {
      throw new BadRequestException(`${fieldName} must be a valid ObjectId`);
    }

    return value;
  }

  /**
   * Validate email format
   */
  static validateEmail(value: any, fieldName: string = 'email', required: boolean = true): string {
    const email = this.validateString(value, fieldName, { required });
    
    if (!email && !required) {
      return '';
    }

    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailPattern.test(email)) {
      throw new BadRequestException(`${fieldName} must be a valid email address`);
    }

    return email.toLowerCase();
  }

  /**
   * Validate username format
   */
  static validateUsername(value: any, fieldName: string = 'username'): string {
    const username = this.validateString(value, fieldName, {
      required: true,
      minLength: 3,
      maxLength: 30,
      pattern: /^[a-zA-Z0-9_.-]+$/
    });

    return username.toLowerCase();
  }

  /**
   * Validate numeric input
   */
  static validateNumber(value: any, fieldName: string, options: {
    required?: boolean;
    min?: number;
    max?: number;
    integer?: boolean;
  } = {}): number {
    if (options.required && (value === undefined || value === null || value === '')) {
      throw new BadRequestException(`${fieldName} is required`);
    }

    if (value === undefined || value === null || value === '') {
      return 0;
    }

    const numValue = Number(value);
    if (isNaN(numValue)) {
      throw new BadRequestException(`${fieldName} must be a valid number`);
    }

    if (options.integer && !Number.isInteger(numValue)) {
      throw new BadRequestException(`${fieldName} must be an integer`);
    }

    if (options.min !== undefined && numValue < options.min) {
      throw new BadRequestException(`${fieldName} must be at least ${options.min}`);
    }

    if (options.max !== undefined && numValue > options.max) {
      throw new BadRequestException(`${fieldName} must not exceed ${options.max}`);
    }

    return numValue;
  }

  /**
   * Validate latitude coordinate
   */
  static validateLatitude(value: any, fieldName: string = 'latitude'): number {
    return this.validateNumber(value, fieldName, {
      required: true,
      min: -90,
      max: 90
    });
  }

  /**
   * Validate longitude coordinate
   */
  static validateLongitude(value: any, fieldName: string = 'longitude'): number {
    return this.validateNumber(value, fieldName, {
      required: true,
      min: -180,
      max: 180
    });
  }

  /**
   * Validate device ID format
   */
  static validateDeviceId(value: any, fieldName: string = 'deviceId'): string {
    return this.validateString(value, fieldName, {
      required: true,
      minLength: 3,
      maxLength: 100,
      pattern: /^[a-zA-Z0-9_.-]+$/
    });
  }

  /**
   * Validate location name
   */
  static validateLocationName(value: any, fieldName: string = 'locationName'): string {
    return this.validateString(value, fieldName, {
      required: true,
      minLength: 2,
      maxLength: 100
    });
  }

  /**
   * Validate company name
   */
  static validateCompanyName(value: any, fieldName: string = 'companyName'): string {
    return this.validateString(value, fieldName, {
      required: true,
      minLength: 2,
      maxLength: 100
    });
  }

  /**
   * Validate display name
   */
  static validateDisplayName(value: any, fieldName: string = 'displayName'): string {
    return this.validateString(value, fieldName, {
      required: true,
      minLength: 1,
      maxLength: 100
    });
  }

  /**
   * Validate timezone format
   */
  static validateTimezone(value: any, fieldName: string = 'timezone'): string {
    const timezone = this.validateString(value, fieldName, { required: false });
    
    if (!timezone) {
      return 'Asia/Kolkata'; // Default timezone
    }

    // Basic timezone validation - should be in format like 'Asia/Kolkata'
    const timezonePattern = /^[A-Za-z]+\/[A-Za-z_]+$/;
    if (!timezonePattern.test(timezone)) {
      throw new BadRequestException(`${fieldName} must be a valid timezone (e.g., Asia/Kolkata)`);
    }

    return timezone;
  }

  /**
   * Sanitize object by removing any potentially dangerous fields
   */
  static sanitizeObject(obj: any, allowedFields: string[]): any {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const sanitized: any = {};
    for (const field of allowedFields) {
      if (obj.hasOwnProperty(field)) {
        sanitized[field] = obj[field];
      }
    }

    return sanitized;
  }
}