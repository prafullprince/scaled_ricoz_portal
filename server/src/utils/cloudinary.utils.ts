import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;
cloudinary.config(
  cloudName && apiKey && apiSecret
    ? {
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      }
    : { secure: true },
);

export function uploadChatFile(
  buffer: Buffer,
  userId: string,
  originalName: string,
) {
  if (!process.env.CLOUDINARY_URL && !(cloudName && apiKey && apiSecret))
    throw new Error("Cloudinary is not configured");
  return new Promise<UploadApiResponse>((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      {
        resource_type: "auto",
        folder: `ricoz/chat/${userId}`,
        use_filename: true,
        unique_filename: true,
        filename_override: originalName,
      },
      (error, result) => {
        if (error || !result)
          return reject(error ?? new Error("Cloudinary upload failed"));
        resolve(result);
      },
    );
    upload.end(buffer);
  });
}

// --- NEW PRODUCT THUMBNAIL UPLOAD FUNCTION ---
export function uploadProductThumbnail(
  buffer: Buffer,
  userId: string,
  originalName: string,
) {
  if (!process.env.CLOUDINARY_URL && !(cloudName && apiKey && apiSecret))
    throw new Error("Cloudinary is not configured");
  return new Promise<UploadApiResponse>((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      {
        resource_type: "image",
        folder: "ricoz/products",
        use_filename: true,
        unique_filename: true,
        filename_override: originalName.slice(0, 255),
        context: { uploaded_by: userId },
      },
      (error, result) => {
        if (error || !result)
          return reject(error ?? new Error("Cloudinary upload failed"));
        resolve(result);
      },
    );
    upload.end(buffer);
  });
}

export function uploadMarketingBlogThumbnail(
  buffer: Buffer,
  userId: string,
  originalName: string,
) {
  if (!process.env.CLOUDINARY_URL && !(cloudName && apiKey && apiSecret))
    throw new Error("Cloudinary is not configured");
  return new Promise<UploadApiResponse>((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      {
        resource_type: "image",
        folder: "ricoz/marketing/blogs",
        use_filename: true,
        unique_filename: true,
        filename_override: originalName.slice(0, 255),
        context: { uploaded_by: userId },
      },
      (error, result) => {
        if (error || !result)
          return reject(error ?? new Error("Cloudinary upload failed"));
        resolve(result);
      },
    );
    upload.end(buffer);
  });
}
