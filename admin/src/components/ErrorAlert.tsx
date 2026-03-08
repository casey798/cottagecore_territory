interface ErrorAlertProps {
  message: string;
  onDismiss?: () => void;
}

export function ErrorAlert({ message, onDismiss }: ErrorAlertProps) {
  return (
    <div className="flex items-center justify-between rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
      <span>{message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="ml-2 font-bold hover:text-red-600"
        >
          x
        </button>
      )}
    </div>
  );
}
