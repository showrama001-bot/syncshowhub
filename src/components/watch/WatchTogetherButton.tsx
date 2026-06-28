import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { createWatchRoom, CreateRoomInput } from "@/lib/watchRooms";

type Props = {
  input: CreateRoomInput;
  label?: string;
  className?: string;
};

export function WatchTogetherButton({ input, label = "Watch Together with Friends", className }: Props) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const onClick = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const id = await createWatchRoom(input);
      toast.success("Room created — invite friends!");
      navigate(`/watch/${id}`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to create room");
    } finally {
      setLoading(false);
    }
  };
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={
        className ??
        "px-5 py-3 rounded-full bg-gradient-red shadow-neon font-semibold flex items-center gap-2 hover:scale-[1.02] transition disabled:opacity-60"
      }
    >
      <Users className="h-4 w-4" /> {loading ? "Creating room…" : label}
    </button>
  );
}