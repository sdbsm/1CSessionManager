using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SessionManager.Control.Data.Migrations
{
    public partial class AddAgentPublications : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "InstalledVersionsJson",
                table: "Agents",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "AgentPublications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AgentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SiteName = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    AppPath = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    PhysicalPath = table.Column<string>(type: "nvarchar(512)", maxLength: 512, nullable: false),
                    Version = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    LastDetectedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AgentPublications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AgentPublications_Agents_AgentId",
                        column: x => x.AgentId,
                        principalTable: "Agents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AgentPublications_AgentId_SiteName_AppPath",
                table: "AgentPublications",
                columns: new[] { "AgentId", "SiteName", "AppPath" },
                unique: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AgentPublications");

            migrationBuilder.DropColumn(
                name: "InstalledVersionsJson",
                table: "Agents");
        }
    }
}
