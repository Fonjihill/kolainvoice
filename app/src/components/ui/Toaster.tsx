import { useToast } from "../../hooks/useToast";

const STYLES = {
  success: "bg-green-50 border-green-500 text-green-700",
  error: "bg-red-50 border-red-500 text-red-700",
  info: "bg-blue-50 border-blue-500 text-blue-700",
};

function Toaster() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          onClick={() => dismiss(toast.id)}
          className={`border px-4 py-3 text-sm font-medium shadow-lg cursor-pointer transition-opacity ${STYLES[toast.type]}`}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}

export default Toaster;
