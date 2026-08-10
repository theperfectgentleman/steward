import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Smaller runtime image for Dokploy (build happens in CI, not on the VPS)
  output: "standalone",
  async redirects() {
    return [
      // Retired peer routes → five-peer shell
      { source: "/my-work", destination: "/tasks?filter=needs-me", permanent: true },
      { source: "/my-work/:path*", destination: "/tasks?filter=needs-me", permanent: true },
      { source: "/assign-work", destination: "/tasks?assign=1", permanent: true },
      { source: "/assign-work/:path*", destination: "/tasks?assign=1", permanent: true },
      { source: "/assignments", destination: "/tasks", permanent: true },
      { source: "/assignments/:path*", destination: "/tasks", permanent: true },
      { source: "/reports", destination: "/documents", permanent: true },
      { source: "/reports/:path*", destination: "/documents", permanent: true },
      { source: "/projects", destination: "/tasks", permanent: true },
      { source: "/projects/:path*", destination: "/tasks", permanent: true },
      { source: "/suggestions", destination: "/tasks", permanent: true },
      { source: "/suggestions/:path*", destination: "/tasks", permanent: true },

      // Schedule / minutes → Events
      { source: "/schedule", destination: "/events", permanent: true },
      { source: "/schedule/:path*", destination: "/events", permanent: true },
      { source: "/minutes", destination: "/events", permanent: true },
      { source: "/minutes/:path*", destination: "/events", permanent: true },

      // Legacy committee workspace URLs → peer tabs + group filter
      {
        source: "/c/:committeeId",
        destination: "/tasks?committeeId=:committeeId",
        permanent: true,
      },
      {
        source: "/c/:committeeId/tasks",
        destination: "/tasks?committeeId=:committeeId",
        permanent: true,
      },
      {
        source: "/c/:committeeId/documents",
        destination: "/documents?committeeId=:committeeId",
        permanent: true,
      },
      {
        source: "/c/:committeeId/schedule",
        destination: "/events?committeeId=:committeeId",
        permanent: true,
      },
      {
        source: "/c/:committeeId/schedule/:eventId",
        destination: "/events/:eventId?committeeId=:committeeId",
        permanent: true,
      },
      {
        source: "/c/:committeeId/minutes",
        destination: "/events?committeeId=:committeeId",
        permanent: true,
      },
      {
        source: "/c/:committeeId/projects",
        destination: "/tasks?committeeId=:committeeId",
        permanent: true,
      },
      {
        source: "/c/:committeeId/projects/:path*",
        destination: "/tasks?committeeId=:committeeId",
        permanent: true,
      },
      {
        source: "/c/:committeeId/assignments",
        destination: "/tasks?committeeId=:committeeId",
        permanent: true,
      },
      {
        source: "/c/:committeeId/assignments/:path*",
        destination: "/tasks?committeeId=:committeeId",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
