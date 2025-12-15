using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SessionManager.Control.Data.Migrations
{
    public partial class AddAgentCommandProgress : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ProgressPercent",
                table: "AgentCommands",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ProgressMessage",
                table: "AgentCommands",
                type: "nvarchar(256)",
                maxLength: 256,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "StartedAtUtc",
                table: "AgentCommands",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastUpdatedAtUtc",
                table: "AgentCommands",
                type: "datetime2",
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ProgressPercent",
                table: "AgentCommands");

            migrationBuilder.DropColumn(
                name: "ProgressMessage",
                table: "AgentCommands");

            migrationBuilder.DropColumn(
                name: "StartedAtUtc",
                table: "AgentCommands");

            migrationBuilder.DropColumn(
                name: "LastUpdatedAtUtc",
                table: "AgentCommands");
        }
    }
}


