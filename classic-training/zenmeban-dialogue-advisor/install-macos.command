#!/bin/zsh
set -euo pipefail

script_dir="${0:A:h}"
codex_root="${CODEX_HOME:-${HOME}/.codex}"
skills_root="${codex_root}/skills"
target_dir="${skills_root}/zenmeban-dialogue-advisor"

if [[ -e "${target_dir}" ]]; then
  print "安装已停止：目标已存在：${target_dir}"
  print "如需升级，请先备份并移走旧目录，再重新运行。"
  exit 2
fi

mkdir -p "${skills_root}"
cp -R "${script_dir}" "${target_dir}"
print "安装完成：${target_dir}"
print "请重新打开 Codex 或新建任务，然后说：用怎么办知识库分析这段录音。"
