
import { updateUserRole, sendDowngradeEmail, downgradeSubscription } from './subscriptionUtils';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, firestore } from './firebase';
import { sendEmail } from './emailService';

jest.mock('./firebase', () => ({
  auth: {
    currentUser: {
      uid: 'test-uid',
    },
  },
  firestore: {
    collection: jest.fn(),
  },
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
  updateDoc: jest.fn(),
}));

jest.mock('./emailService', () => ({
  sendEmail: jest.fn(),
}));

describe('Subscription Downgrade', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('updateUserRole', () => {
    it('should update user role to "coach"', async () => {
      const userId = 'test-user-id';
      await updateUserRole(userId, 'coach');
      expect(updateDoc).toHaveBeenCalledWith(undefined, { role: 'coach' });
    });
  });

  describe('sendDowngradeEmail', () => {
    it('should send a downgrade email to the user', async () => {
      const user = {
        email: 'test@example.com',
        displayName: 'Test User',
      };
      await sendDowngradeEmail(user);
      expect(sendEmail).toHaveBeenCalledWith(
        user.email,
        'Subscription Downgrade Confirmation',
        expect.any(String)
      );
    });
  });

  describe('downgradeSubscription', () => {
    it('should successfully downgrade a premium user', async () => {
      const userId = 'test-premium-user-id';
      const user = {
        email: 'premium@example.com',
        displayName: 'Premium User',
        role: 'premium',
      };

      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => user,
      });

      await downgradeSubscription(userId);

      expect(updateDoc).toHaveBeenCalledWith(undefined, {
        role: 'coach',
        subscription: {
          plan: 'free',
          status: 'downgraded',
        },
      });
      expect(sendEmail).toHaveBeenCalled();
    });

    it('should handle non-existent user', async () => {
      const userId = 'non-existent-user-id';

      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => false,
      });

      await expect(downgradeSubscription(userId)).rejects.toThrow(
        'User not found'
      );
    });
  });
});
