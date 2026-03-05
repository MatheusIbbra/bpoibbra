import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Sentry } from "@/lib/sentry";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  label?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class DashboardCardBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    Sentry.captureException(error, {
      extra: { componentStack: info.componentStack, label: this.props.label },
    });
    console.error("[DashboardCardBoundary]", this.props.label, error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className="border border-destructive/20 bg-destructive/5">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-8 text-center">
            <AlertTriangle className="h-8 w-8 text-destructive/60" />
            <p className="text-sm text-muted-foreground">
              {this.props.label
                ? `"${this.props.label}" encontrou um erro`
                : "Este módulo encontrou um erro"}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 border-destructive/30 text-destructive hover:bg-destructive/10"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      );
    }
    return this.props.children;
  }
}
