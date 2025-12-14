using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SessionManager.Control.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Agents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    Hostname = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    LastSeenAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    RacPath = table.Column<string>(type: "nvarchar(512)", maxLength: 512, nullable: false),
                    RasHost = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    ClusterUser = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    ClusterPassProtected = table.Column<string>(type: "nvarchar(2048)", maxLength: 2048, nullable: true),
                    KillModeEnabled = table.Column<bool>(type: "bit", nullable: false),
                    PollIntervalSeconds = table.Column<int>(type: "int", nullable: false),
                    Enabled = table.Column<bool>(type: "bit", nullable: false),
                    LastKnownClusterStatus = table.Column<byte>(type: "tinyint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Agents", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "AgentMetricBuckets",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    AgentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BucketStartUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ClusterStatus = table.Column<byte>(type: "tinyint", nullable: false),
                    CpuPercent = table.Column<short>(type: "smallint", nullable: false),
                    MemoryUsedMb = table.Column<int>(type: "int", nullable: false),
                    MemoryTotalMb = table.Column<int>(type: "int", nullable: false),
                    TotalSessions = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AgentMetricBuckets", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AgentMetricBuckets_Agents_AgentId",
                        column: x => x.AgentId,
                        principalTable: "Agents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Clients",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AgentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    MaxSessions = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<byte>(type: "tinyint", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Clients", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Clients_Agents_AgentId",
                        column: x => x.AgentId,
                        principalTable: "Agents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Events",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    AgentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TimestampUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Level = table.Column<byte>(type: "tinyint", nullable: false),
                    Message = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false),
                    ClientId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ClientName = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    DatabaseName = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    SessionId = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    UserName = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Events", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Events_Agents_AgentId",
                        column: x => x.AgentId,
                        principalTable: "Agents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ClientDatabases",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AgentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ClientId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    InfobaseUuid = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClientDatabases", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ClientDatabases_Agents_AgentId",
                        column: x => x.AgentId,
                        principalTable: "Agents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ClientDatabases_Clients_ClientId",
                        column: x => x.ClientId,
                        principalTable: "Clients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ClientMetricBuckets",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    AgentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BucketStartUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ClientId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ActiveSessions = table.Column<int>(type: "int", nullable: false),
                    MaxSessions = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<byte>(type: "tinyint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClientMetricBuckets", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ClientMetricBuckets_Agents_AgentId",
                        column: x => x.AgentId,
                        principalTable: "Agents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ClientMetricBuckets_Clients_ClientId",
                        column: x => x.ClientId,
                        principalTable: "Clients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AgentMetricBuckets_AgentId_BucketStartUtc",
                table: "AgentMetricBuckets",
                columns: new[] { "AgentId", "BucketStartUtc" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Agents_Hostname",
                table: "Agents",
                column: "Hostname");

            migrationBuilder.CreateIndex(
                name: "IX_ClientDatabases_AgentId_Name",
                table: "ClientDatabases",
                columns: new[] { "AgentId", "Name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ClientDatabases_ClientId",
                table: "ClientDatabases",
                column: "ClientId");

            migrationBuilder.CreateIndex(
                name: "IX_ClientMetricBuckets_AgentId_BucketStartUtc_ClientId",
                table: "ClientMetricBuckets",
                columns: new[] { "AgentId", "BucketStartUtc", "ClientId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ClientMetricBuckets_ClientId",
                table: "ClientMetricBuckets",
                column: "ClientId");

            migrationBuilder.CreateIndex(
                name: "IX_Clients_AgentId_Name",
                table: "Clients",
                columns: new[] { "AgentId", "Name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Events_AgentId_TimestampUtc",
                table: "Events",
                columns: new[] { "AgentId", "TimestampUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_Events_Level",
                table: "Events",
                column: "Level");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AgentMetricBuckets");

            migrationBuilder.DropTable(
                name: "ClientDatabases");

            migrationBuilder.DropTable(
                name: "ClientMetricBuckets");

            migrationBuilder.DropTable(
                name: "Events");

            migrationBuilder.DropTable(
                name: "Clients");

            migrationBuilder.DropTable(
                name: "Agents");
        }
    }
}
