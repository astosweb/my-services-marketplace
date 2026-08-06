import UIKit

/// Downscales and JPEG-encodes photos before multipart upload.
enum ImageUploadPrep {
    enum Kind {
        case requestPhoto
        case messageAttachment
        case supportAttachment
        case avatar

        var maxDimension: CGFloat {
            switch self {
            case .requestPhoto, .messageAttachment, .supportAttachment: return 1920
            case .avatar: return 1024
            }
        }

        var quality: CGFloat {
            switch self {
            case .requestPhoto, .messageAttachment, .supportAttachment: return 0.72
            case .avatar: return 0.78
            }
        }

        var maxBytes: Int {
            switch self {
            case .requestPhoto, .messageAttachment, .supportAttachment: return 1_500_000
            case .avatar: return 500_000
            }
        }
    }

    static func jpegData(from image: UIImage, kind: Kind) -> Data? {
        let prepared = resized(image, maxDimension: kind.maxDimension)
        var quality = kind.quality
        var data = prepared.jpegData(compressionQuality: quality)
        while let current = data, current.count > kind.maxBytes, quality > 0.4 {
            quality -= 0.08
            data = prepared.jpegData(compressionQuality: quality)
        }
        return data
    }

    private static func resized(_ image: UIImage, maxDimension: CGFloat) -> UIImage {
        let size = image.size
        let longest = max(size.width, size.height)
        guard longest > maxDimension, longest > 0 else { return image }

        let scale = maxDimension / longest
        let newSize = CGSize(width: (size.width * scale).rounded(.down), height: (size.height * scale).rounded(.down))
        guard newSize.width >= 1, newSize.height >= 1 else { return image }

        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        format.opaque = true
        let renderer = UIGraphicsImageRenderer(size: newSize, format: format)
        return renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: newSize))
        }
    }
}
