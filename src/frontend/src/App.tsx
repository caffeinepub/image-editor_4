import { Toaster } from "@/components/ui/sonner";
import ImageEditor from "./components/ImageEditor";

export default function App() {
  return (
    <div className="h-screen w-screen overflow-hidden">
      <ImageEditor />
      <Toaster />
    </div>
  );
}
