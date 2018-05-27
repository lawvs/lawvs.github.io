---
title: Window 下 MySQL 管理员密码重置
date: 2017-12-21 23:00
tags:
- MySQL
---

- 不小心忘记 MySQL 的 root 密码，该怎么办？
+ <!--more-->

## 缘起

- 由于想学一点 PHP 需要用到数据库，于是从硬盘中翻出半年多没用的 MySQL
- 但是因为太久没用了，管理员密码怎么试都不正确
- 被逼无奈只好翻阅资料尝试重置密码
- === 以下教程基于Windows10 及 MySQL5.7 ===

## 跳过密码登录

- 第一种方式是修改 MySQL 配置
	- 在 MySQL 目录下的配置文件 my.ini 中添加`skip-grant-tables`，保存后重启数据库`net stop mysql && net start mysql`，之后即可无密码进入数据库
- 第二种是跳过权限表限制启动 MySQL ，当然在此之前需要关闭原有的需要密码的数据库，否则无法启动
	- `net stop mysql && mysqld --skip-grant-tables`

## 修改管理员密码

- 在 mysql 命令行模式输入以下命令

```sql
#  使用 mysql 这个数据库
use mysql;
# 修改 root 用户密码(注意：在旧版本数据库需要把 authentication_string 替换为 password)
update user set authentication_string=password("%PASSWORD%") where user="root";
# 重新加载权限表 更新权限
flush privileges;
exit;
```

## 自动化

- 写成脚本

```cmd
:: resetMysqlPassword.bat

:::::::::::::::::::::::
:: 功能：一键重置 MySQL 密码
:: 确保 mysql/bin 已加入环境变量
:: 确保使用管理员权限执行
::
:: date: 2017-12-21
:::::::::::::::::::::::

:: 停止命令回显
@ echo off
:: 停止 mysql 服务
net stop mysql
:: 跳过权限表限制启动 MySQL
start mysqld --skip-grant-tables

set /p PASSWORD="请输入新密码:"
mysql -e "use mysql;update user set authentication_string=password('%PASSWORD%') where user='root';flush privileges;"

:: 杀进程 mysqld
taskkill -F /im mysqld.exe
:: 启动 mysql
net start mysql

pause
```

- 执行完成后尝试登录数据库，登录成功说明重置密码成功

```cmd
:: 登录数据库
set /p PASSWORD="请输入新密码:"
mysql --user=root --password=%PASSWORD%
```
