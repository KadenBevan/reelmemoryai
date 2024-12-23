{ pkgs }: {
  deps = [
    pkgs.pm2
    pkgs.nodejs-18_x
    pkgs.nodePackages.typescript
  ];
}