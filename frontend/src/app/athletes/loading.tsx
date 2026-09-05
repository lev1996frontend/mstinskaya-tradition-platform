import { RouteLoading } from "@/components/layout/route-loading";

/* This route reads live data on the server, so navigating to it has a real
   wait in it. Without this file the previous page simply stood there. */
export default function Loading() {
  return <RouteLoading />;
}
