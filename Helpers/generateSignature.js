import crypto from 'crypto';

export default function generateSignature(dataArray, secretkey) {
    const dataString = dataArray.join(';');
    return crypto.createHmac('md5', secretkey).update(dataString).digest('hex');
}