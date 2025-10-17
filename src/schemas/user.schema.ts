import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema()
export class User {
  @Prop({ required: false }) // Optional for admin users who exist before companies
  companyId?: string;

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

// Create indexes for optimal query performance
// Compound unique index for users with companies
UserSchema.index({ companyId: 1, username: 1 }, { unique: true, sparse: true });
// Unique index for admin users without companies
UserSchema.index({ username: 1 }, { unique: true, partialFilterExpression: { companyId: { $exists: false } } });
// Additional indexes for queries
UserSchema.index({ companyId: 1, role: 1 }); // Company user filtering
UserSchema.index({ assignedDeviceId: 1 }, { sparse: true }); // Device assignment lookups