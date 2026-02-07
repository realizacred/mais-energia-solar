 import { useState, useRef } from "react";
 import { Button } from "@/components/ui/button";
 import { Label } from "@/components/ui/label";
 import { Video, Upload, Trash2, Square, Circle, Play } from "lucide-react";
 import { supabase } from "@/integrations/supabase/client";
 import { toast } from "@/hooks/use-toast";
 
 interface VideoCaptureProps {
   videoUrl: string | null;
   onVideoChange: (url: string | null) => void;
   servicoId: string;
 }
 
 export function VideoCapture({ videoUrl, onVideoChange, servicoId }: VideoCaptureProps) {
   const [isRecording, setIsRecording] = useState(false);
   const [isUploading, setIsUploading] = useState(false);
   const mediaRecorderRef = useRef<MediaRecorder | null>(null);
   const videoInputRef = useRef<HTMLInputElement>(null);
   const recordedChunksRef = useRef<BlobPart[]>([]);
 
   const startRecording = async () => {
     try {
       const stream = await navigator.mediaDevices.getUserMedia({ 
         video: { facingMode: "environment" }, 
         audio: true 
       });
       
       const mediaRecorder = new MediaRecorder(stream);
       recordedChunksRef.current = [];
       
       mediaRecorder.ondataavailable = (e) => {
         if (e.data.size > 0) {
           recordedChunksRef.current.push(e.data);
         }
       };
       
       mediaRecorder.onstop = async () => {
         const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
         await uploadVideo(blob);
         stream.getTracks().forEach(track => track.stop());
       };
       
       mediaRecorder.start();
       mediaRecorderRef.current = mediaRecorder;
       setIsRecording(true);
     } catch (error) {
       console.error("Error starting video recording:", error);
       toast({
         title: "Erro ao gravar",
         description: "Permita o acesso à câmera e microfone.",
         variant: "destructive",
       });
     }
   };
 
   const stopRecording = () => {
     if (mediaRecorderRef.current) {
       mediaRecorderRef.current.stop();
       setIsRecording(false);
     }
   };
 
   const uploadVideo = async (blob: Blob) => {
     setIsUploading(true);
     try {
       const fileName = `${servicoId}/video_${Date.now()}.webm`;
       
       const { error } = await supabase.storage
         .from('checklist-assets')
         .upload(fileName, blob, { upsert: true });
 
       if (error) throw error;
 
       const { data: urlData } = supabase.storage
         .from('checklist-assets')
         .getPublicUrl(fileName);
 
       onVideoChange(urlData.publicUrl);
       toast({
         title: "Vídeo salvo",
         description: "Gravação anexada com sucesso.",
       });
     } catch (error) {
       console.error("Error uploading video:", error);
       toast({
         title: "Erro ao salvar vídeo",
         description: "Tente novamente.",
         variant: "destructive",
       });
     } finally {
       setIsUploading(false);
     }
   };
 
   const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (file) {
       if (file.size > 100 * 1024 * 1024) { // 100MB limit
         toast({
           title: "Arquivo muito grande",
           description: "O vídeo deve ter no máximo 100MB.",
           variant: "destructive",
         });
         return;
       }
       await uploadVideo(file);
     }
     if (videoInputRef.current) {
       videoInputRef.current.value = '';
     }
   };
 
   const removeVideo = () => {
     onVideoChange(null);
   };
 
   return (
     <div className="space-y-3 pt-4 border-t">
       <div className="flex items-center gap-2">
         <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center">
           <Video className="h-4 w-4 text-secondary" />
         </div>
         <div>
           <Label className="text-sm font-medium">Vídeo</Label>
           <p className="text-xs text-muted-foreground">Grave ou anexe um vídeo</p>
         </div>
       </div>
       
       {videoUrl ? (
         <div className="p-3 bg-muted/50 rounded-lg border border-border/50">
           <video 
             controls 
             className="w-full rounded-lg max-h-48" 
             src={videoUrl}
           />
           <Button
             type="button"
             variant="ghost"
             size="sm"
             className="mt-2 text-destructive hover:text-destructive"
             onClick={removeVideo}
           >
             <Trash2 className="h-3 w-3 mr-1" />
             Remover vídeo
           </Button>
         </div>
       ) : (
         <div className="flex gap-2">
           <input
             ref={videoInputRef}
             type="file"
             accept="video/*"
             className="hidden"
             onChange={handleFileSelect}
           />
           <Button
             type="button"
             variant={isRecording ? "destructive" : "outline"}
             size="sm"
             className="flex-1 gap-2 h-10"
             onClick={isRecording ? stopRecording : startRecording}
             disabled={isUploading}
           >
             {isRecording ? (
               <>
                 <Square className="h-4 w-4" />
                 Parar Gravação
               </>
             ) : (
               <>
                 <Circle className="h-4 w-4 text-destructive" />
                 Gravar Vídeo
               </>
             )}
           </Button>
           <Button
             type="button"
             variant="outline"
             size="sm"
             className="flex-1 gap-2 h-10"
             onClick={() => videoInputRef.current?.click()}
             disabled={isRecording || isUploading}
           >
             <Upload className="h-4 w-4" />
             Anexar Vídeo
           </Button>
         </div>
       )}
     </div>
   );
 }