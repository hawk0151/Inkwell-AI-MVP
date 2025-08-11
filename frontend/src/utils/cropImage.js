const createImage = (url) =>
    new Promise((resolve, reject) => {
        const image = new Image();
        image.addEventListener('load', () => resolve(image));
        image.addEventListener('error', (error) => reject(error));
        image.setAttribute('crossOrigin', 'anonymous'); // Needed to avoid cross-origin issues
        image.src = url;
    });

/**
 * This function returns the cropped image as a File object.
 * @param {string} imageSrc The image source url
 * @param {object} pixelCrop The crop area in pixels
 * @param {number} rotation The rotation of the image
 */
export default async function getCroppedImg(imageSrc, pixelCrop) {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Get the canvas size based on the image's aspect ratio
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    canvas.width = pixelCrop.width * scaleX;
    canvas.height = pixelCrop.height * scaleY;

    ctx.drawImage(
        image,
        pixelCrop.x * scaleX,
        pixelCrop.y * scaleY,
        pixelCrop.width * scaleX,
        pixelCrop.height * scaleY,
        0,
        0,
        canvas.width,
        canvas.height
    );

    // As a base64 string
    // const base64Image = canvas.toDataURL('image/jpeg');

    // As a Blob for file upload
    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                console.error('Canvas is empty');
                return;
            }
            resolve(new File([blob], 'cropped_cover.jpeg', { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.95);
    });
}