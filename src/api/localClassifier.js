import { loadTensorflowModel } from 'react-native-fast-tflite';
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import { Image, Skia } from '@shopify/react-native-skia';
import * as ImageManipulator from 'expo-image-manipulator';

let model = null;
let labels = [];

export async function loadModel() {
    if (model) return model;

    try {
        const modelAsset = Asset.fromModule(require('../../assets/models/mobilenet_v2_1.0_224_quant.tflite'));
        await modelAsset.downloadAsync();

        // Use localUri to load
        model = await loadTensorflowModel({ url: modelAsset.localUri });

        const labelsAsset = Asset.fromModule(require('../../assets/models/labels.txt'));
        await labelsAsset.downloadAsync();
        const text = await FileSystem.readAsStringAsync(labelsAsset.localUri);
        labels = text.split('\n').map(l => l.trim()).filter(Boolean);

        console.log('Local TFLite Model Loaded');
        return model;
    } catch (e) {
        console.error('Failed to load local model', e);
        throw e;
    }
}

export async function classifyImage(imageUri) {
    const loadedModel = await loadModel();

    // 1. Resize to 224x224 using ImageManipulator (faster than loading huge image into Skia)
    const manipResult = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 224, height: 224 } }],
        { format: ImageManipulator.SaveFormat.PNG } // PNG to avoid compression artifacts if possible, though JPEG is fine
    );

    // 2. Decode with Skia to get pixels
    const data = await FileSystem.readAsStringAsync(manipResult.uri, { encoding: FileSystem.EncodingType.Base64 });
    const skData = Skia.Data.fromBase64(data);
    const skImage = Skia.Image.MakeImageFromEncoded(skData);

    if (!skImage) throw new Error('Could not decode image for classification');

    // 3. Get Pixels (RGB)
    // MobileNetV2 Quantized expects: 224x224x3 (uint8) [0-255]
    // Skia readPixels returns RGBA usually. We might need to drop alpha.
    // However, simpler models might accept RGBA if input shape matches? 
    // Standard MobileNetV2 is 1x224x224x3.

    // We need to verify input shape of the model
    // Assuming 1x224x224x3

    const pixels = skImage.readPixels(0, 0, {
        width: 224,
        height: 224,
        colorType: 4, // 4 = RGBA_8888 (usually) - check Skia types if needed, often BGRA or RGBA
        alphaType: 1, // Premul
    });

    if (!pixels) throw new Error('Could not read pixels');

    // Convert to RGB if model strictly needs 3 channels (most do)
    // This loop in JS is slow. Ideally pass RGBA if model supports it, OR use native buffer ops.
    // For basic poc, we iterate.

    const rgbArray = new Uint8Array(224 * 224 * 3);
    for (let i = 0; i < 224 * 224; i++) {
        rgbArray[i * 3 + 0] = pixels[i * 4 + 0]; // R
        rgbArray[i * 3 + 1] = pixels[i * 4 + 1]; // G
        rgbArray[i * 3 + 2] = pixels[i * 4 + 2]; // B
        // Skip alpha
    }

    // 4. Run Inference
    const input = rgbArray;
    const output = await loadedModel.run([input]); // Output is often Uint8Array of probabilites (quant)

    // 5. Parse Output
    // MobileNet Output: Array of probabilities matching labels index
    const results = output[0]; // First tensor output

    // Find top match
    let maxIndex = 0;
    let maxVal = 0;

    // results could be Uint8Array (0-255) for Quantized
    for (let i = 0; i < results.length; i++) {
        if (results[i] > maxVal) {
            maxVal = results[i];
            maxIndex = i;
        }
    }

    const label = labels[maxIndex] || 'unknown';
    const confidence = maxVal / 255.0; // Normalize 0-255 to 0-1

    return { label, confidence };
}
