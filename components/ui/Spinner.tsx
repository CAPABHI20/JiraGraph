export default function Spinner() {
  return (
    <div className="relative w-7 h-7">
      <div className="absolute inset-0 rounded-full border-2 border-white/10" />
      <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-violet-400 border-r-indigo-400 animate-spin" />
    </div>
  );
}
