/**
 * Smart Media Engine — UI components barrel.
 *
 * New admin uploaders that talk to /api/media/upload.
 * The legacy single/multi uploaders in components/ui stay untouched.
 */

export { SmartMediaUploader, type SmartMediaUploaderProps, type UploadedAsset } from './SmartMediaUploader';
export { MultiSmartMediaUploader, type MultiSmartMediaUploaderProps } from './MultiSmartMediaUploader';
export { SeoInputsPanel, EMPTY_SEO_INPUTS, type SeoInputsValue } from './SeoInputsPanel';
export { CropModal, type CropResult, type CropModalProps } from './CropModal';
export { MediaPickerDialog, type MediaPickerDialogProps } from './MediaPickerDialog';
export { TagsInput } from './TagsInput';
