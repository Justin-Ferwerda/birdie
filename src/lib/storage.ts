import imageCompression from 'browser-image-compression';
import { supabase } from './supabase';

const BUCKET = 'rule-photos';

interface UploadArgs {
  tournament_id: string;
  player_number: number;
  rule_key: string;
  file: File;
}

/** Client-side compresses a captured image and uploads it to the
 *  rule-photos bucket. Returns the public URL.
 *  Path: <tournament_id>/<player_number>/<rule_key>-<ts>.<ext> */
export async function uploadRulePhoto({
  tournament_id,
  player_number,
  rule_key,
  file,
}: UploadArgs): Promise<string> {
  const compressed = await imageCompression(file, {
    maxSizeMB: 0.5,
    maxWidthOrHeight: 1280,
    useWebWorker: true,
  });

  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
  const path = `${tournament_id}/${player_number}/${rule_key}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, compressed, {
    contentType: compressed.type || file.type || 'image/jpeg',
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
