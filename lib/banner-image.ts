export async function bannerImage(file: File): Promise<string> {
  if (!["image/jpeg","image/png","image/webp"].includes(file.type)) throw Error("Choose a PNG, JPEG or WebP image.");
  if (file.size > 8 * 1024 * 1024) throw Error("Choose an image smaller than 8 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1200; canvas.height = 400;
    const context = canvas.getContext("2d");
    if (!context) throw Error("Your browser could not prepare this image.");
    const scale = Math.max(canvas.width / bitmap.width,canvas.height / bitmap.height);
    const width = bitmap.width * scale, height = bitmap.height * scale;
    context.drawImage(bitmap,(canvas.width-width)/2,(canvas.height-height)/2,width,height);
    for (const quality of [.82,.65,.45,.25]) {
      const value = canvas.toDataURL("image/webp",quality);
      if (value.startsWith("data:image/webp;") && value.length <= 174780) return value;
    }
    throw Error("This image is too detailed. Choose a smaller or simpler image.");
  } finally { bitmap.close(); }
}
