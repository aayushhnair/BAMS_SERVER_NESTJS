import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DeviceDocument = Device & Document;

@Schema()
export class Device {
  @Prop({ required: true, unique: true })
  deviceId: string;

  @Prop({ required: true })
  serial: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  companyId: string;

  @Prop()
  assignedTo?: string;

  @Prop({ default: () => new Date() })
  lastSeen: Date;
}

export const DeviceSchema = SchemaFactory.createForClass(Device);

// Create unique index on deviceId
DeviceSchema.index({ deviceId: 1 }, { unique: true });