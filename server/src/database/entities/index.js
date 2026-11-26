import { UserSchema } from './User.js';
import { UserGroupSchema } from './UserGroup.js';
import { ExamSchema } from './Exam.js';
import { ExamTableSchema } from './ExamTable.js';
import { ExamRowSchema } from './ExamRow.js';
import { ExamCallingRowSchema } from './ExamCallingRow.js';
import { ExamLinkSchema } from './ExamLink.js';
import { VendorSchema } from './Vendor.js';
import { VendorMetaSchema } from './VendorMeta.js';
import { DeviceSchema } from './Device.js';
import { DeviceMetaSchema } from './DeviceMeta.js';
import { CenterCsrMatchingSchema } from './CenterCsrMatching.js';
import { CenterCsrMatchingMetaSchema } from './CenterCsrMatchingMeta.js';
import { deviceTabEntitySchemas } from './deviceTabSchemas.js';
import { SeqViewSchema } from './SeqView.js';
import { SeqViewMetaSchema } from './SeqViewMeta.js';
import { UserTableMetaSchema } from './UserTableMeta.js';
import { UserTagSchema } from './UserTag.js';
import { ExamFieldPresetSchema } from './ExamFieldPreset.js';
import { DeviceFieldPresetSchema } from './DeviceFieldPreset.js';
import { SystemSettingSchema } from './SystemSetting.js';
import { UserPreferenceSchema } from './UserPreference.js';
import { NotificationSchema } from './Notification.js';
import { AnnouncementSchema } from './Announcement.js';
import { LegalDocumentSchema } from './LegalDocument.js';
import { AuditLogSchema } from './AuditLog.js';
import { ConfigDropdownListSchema } from './ConfigDropdownList.js';
import { FeedbackSchema } from './Feedback.js';

export const entities = [
  UserSchema,
  UserGroupSchema,
  ExamSchema,
  ExamTableSchema,
  ExamRowSchema,
  ExamCallingRowSchema,
  ExamLinkSchema,
  VendorSchema,
  VendorMetaSchema,
  DeviceSchema,
  DeviceMetaSchema,
  CenterCsrMatchingSchema,
  CenterCsrMatchingMetaSchema,
  ...deviceTabEntitySchemas,
  SeqViewSchema,
  SeqViewMetaSchema,
  UserTableMetaSchema,
  UserTagSchema,
  ExamFieldPresetSchema,
  DeviceFieldPresetSchema,
  SystemSettingSchema,
  UserPreferenceSchema,
  NotificationSchema,
  AnnouncementSchema,
  LegalDocumentSchema,
  AuditLogSchema,
  ConfigDropdownListSchema,
  FeedbackSchema,
];

export { User } from './User.js';
export { UserGroup } from './UserGroup.js';
export { Exam } from './Exam.js';
export { ExamTable } from './ExamTable.js';
export { ExamRow } from './ExamRow.js';
export { ExamCallingRow } from './ExamCallingRow.js';
export { ExamLink } from './ExamLink.js';
export { Vendor } from './Vendor.js';
export { VendorMeta } from './VendorMeta.js';
export { Device } from './Device.js';
export { DeviceMeta } from './DeviceMeta.js';
export { CenterCsrMatching } from './CenterCsrMatching.js';
export { CenterCsrMatchingMeta } from './CenterCsrMatchingMeta.js';
export { SeqView } from './SeqView.js';
export { SeqViewMeta } from './SeqViewMeta.js';
export { UserTableMeta } from './UserTableMeta.js';
export { UserTag } from './UserTag.js';
export { ExamFieldPreset } from './ExamFieldPreset.js';
export { DeviceFieldPreset } from './DeviceFieldPreset.js';
export { SystemSetting } from './SystemSetting.js';
export { UserPreference } from './UserPreference.js';
export { Notification } from './Notification.js';
export { Announcement } from './Announcement.js';
export { LegalDocument } from './LegalDocument.js';
export { AuditLog } from './AuditLog.js';
export { ConfigDropdownList } from './ConfigDropdownList.js';
export { Feedback } from './Feedback.js';
