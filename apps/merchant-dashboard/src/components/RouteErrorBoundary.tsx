import { Component, type ErrorInfo, type ReactNode } from "react";
import { Alert, Button } from "@store-builder/ui";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "This page couldn't be displayed.",
    body: "Something went wrong while showing it. Reload to try again, or use the menu to open another page.",
    reload: "Reload",
  },
  ar: {
    title: "تعذّر عرض هذه الصفحة.",
    body: "حدث خطأ أثناء عرضها. أعد التحميل للمحاولة مرة أخرى، أو استخدم القائمة لفتح صفحة أخرى.",
    reload: "إعادة التحميل",
  },
} satisfies Messages;

function RouteErrorFallback() {
  const t = useT(STRINGS);
  return (
    <Alert variant="danger" className="flex max-w-xl flex-col gap-3">
      <span className="font-medium">{t.title}</span>
      <span>{t.body}</span>
      <div>
        <Button size="sm" variant="outline" onClick={() => window.location.reload()} className="min-h-11">
          {t.reload}
        </Button>
      </div>
    </Alert>
  );
}

interface Props {
  /** Clears a caught error when it changes, i.e. when the user navigates away. */
  resetKey: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
  errorKey: string | null;
}

/**
 * Catches a render crash in one dashboard page so it shows a message in the
 * content area instead of unmounting the whole app. The sidebar and header
 * stay usable, and navigating to another page clears the error.
 */
export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null, errorKey: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    // An error caught on one page must not stick to the next one.
    if (state.error && state.errorKey !== null && state.errorKey !== props.resetKey) {
      return { error: null, errorKey: null };
    }
    return null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ errorKey: this.props.resetKey });
    console.error("Dashboard page crashed:", error, info.componentStack);
  }

  render() {
    return this.state.error ? <RouteErrorFallback /> : this.props.children;
  }
}
