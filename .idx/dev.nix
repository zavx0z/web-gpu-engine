# .idx/dev.nix
{ pkgs, ... }: {
  channel = "unstable";
  packages = [ pkgs.bun ]; # Убедитесь, что bun добавлен
  idx.previews = {
    enable = true;
    previews = {
      web = {
        # Переменная $PORT будет автоматически подставлена IDX
        command = [ "bun" "run" "--hot" "serve.ts" ];
        manager = "web";
        env = {
          PORT = "$PORT"; # Явно передаем переменную серверу
        };
      };
    };
  };
}
