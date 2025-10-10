import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema()
export class User {
  @Prop({ required: true })
  companyId: string;

  @Prop({ required: true })
  username: string;

  @Prop({ required: true })
  password: string; // bcrypt hashed password

  @Prop({ required: true })
  displayName: string;

  @Prop()
  assignedDeviceId?: string;

  @Prop()
  allocatedLocationId?: string;

  @Prop({ required: true, enum: ['employee', 'admin'], default: 'employee' })
  role: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Create compound unique index
UserSchema.index({ companyId: 1, username: 1 }, { unique: true });