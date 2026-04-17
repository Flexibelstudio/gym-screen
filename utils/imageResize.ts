export const resizeAndCompressImage = (fileOrBase64: File | string, maxWidth = 1000, maxHeight = 1000, quality = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            let width = img.width;
            let height = img.height;
            
            // Calculate new dimensions
            if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
            }
            if (height > maxHeight) {
                width = Math.round((width * maxHeight) / height);
                height = maxHeight;
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error("Failed to get canvas context"));
                return;
            }

            // Draw and compress
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', quality);
            resolve(dataUrl);
        };
        img.onerror = (err) => reject(err);

        if (fileOrBase64 instanceof File) {
            const reader = new FileReader();
            reader.onload = (e) => {
                if (e.target?.result) {
                    img.src = e.target.result as string;
                }
            };
            reader.onerror = (err) => reject(err);
            reader.readAsDataURL(fileOrBase64);
        } else {
            // Check if crossOrigin is needed for external URLs
            if (fileOrBase64.startsWith('http')) {
                img.crossOrigin = "anonymous";
            }
            img.src = fileOrBase64;
        }
    });
};
