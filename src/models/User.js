import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'agent', 'customer'], default: 'customer', index: true },
    storeName: { type: String, trim: true },
    storeSlug: { type: String, unique: true, sparse: true, lowercase: true, trim: true, index: true },
    storeEnabled: { type: Boolean, default: true },
    location: { type: String, trim: true },
    momoNumber: { type: String, trim: true },
    currentBusiness: { type: String, trim: true },
    experience: { type: String, trim: true },
    reason: { type: String, trim: true },
    expectedVolume: { type: String, trim: true },
    referralCode: { type: String, unique: true, sparse: true, uppercase: true, trim: true, index: true },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    agentStatus: {
      type: String,
      enum: ['pending_payment', 'active', 'suspended'],
      default: function defaultAgentStatus() {
        return this.role === 'agent' ? 'pending_payment' : 'active';
      }
    },
    isActive: {
      type: Boolean,
      default: function defaultIsActive() {
        return this.role === 'agent' ? false : true;
      }
    },
    balance: { type: Number, default: 0 },
    pendingBalance: { type: Number, default: 0 },
    referralBalance: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 },
    totalEarned: { type: Number, default: 0 },
    totalSales: { type: Number, default: 0 },
    totalOrders: { type: Number, default: 0 },
    defaultMarkupPercent: { type: Number, default: 0 },
    customPrices: { type: Map, of: Number },
    onboardingPaidAt: Date,
    lastLogin: Date
  },
  {
    timestamps: true
  }
);

userSchema.pre('save', async function hashPasswordAndSyncFlags(next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }

  if (this.role === 'agent') {
    if (this.agentStatus === 'active') {
      this.isActive = true;
    } else if (this.agentStatus === 'pending_payment' || this.agentStatus === 'suspended') {
      this.isActive = false;
    }

    if (this.isModified('isActive') && !this.isModified('agentStatus')) {
      this.agentStatus = this.isActive ? 'active' : 'suspended';
    }
  }

  next();
});

userSchema.methods.comparePassword = async function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

export const User = mongoose.model('User', userSchema);