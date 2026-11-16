using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LoanManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddAffordabilityChecks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "BureauMinScore",
                table: "LoanProducts",
                type: "int",
                nullable: false,
                defaultValue: 600);

            migrationBuilder.AddColumn<int>(
                name: "BureauReferScore",
                table: "LoanProducts",
                type: "int",
                nullable: false,
                defaultValue: 650);

            migrationBuilder.AddColumn<decimal>(
                name: "MinRemainingIncomePercent",
                table: "LoanProducts",
                type: "decimal(5,2)",
                precision: 5,
                scale: 2,
                nullable: false,
                defaultValue: 20m);

            migrationBuilder.AddColumn<decimal>(
                name: "StressTestRatePoints",
                table: "LoanProducts",
                type: "decimal(5,2)",
                precision: 5,
                scale: 2,
                nullable: false,
                defaultValue: 3m);

            migrationBuilder.AddColumn<bool>(
                name: "BureauHasAdverseListing",
                table: "AffordabilityAssessments",
                type: "bit",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BureauOutcome",
                table: "AffordabilityAssessments",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BureauReference",
                table: "AffordabilityAssessments",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "BureauScore",
                table: "AffordabilityAssessments",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "MinRemainingPassed",
                table: "AffordabilityAssessments",
                type: "bit",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "MinRemainingRequired",
                table: "AffordabilityAssessments",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "OutcomeReasons",
                table: "AffordabilityAssessments",
                type: "nvarchar(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "StressTestPassed",
                table: "AffordabilityAssessments",
                type: "bit",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "StressedDisposableAfterLoan",
                table: "AffordabilityAssessments",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "StressedInstallment",
                table: "AffordabilityAssessments",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.UpdateData(
                table: "LoanProducts",
                keyColumn: "Id",
                keyValue: 1,
                columns: new[] { "BureauMinScore", "BureauReferScore", "MinRemainingIncomePercent", "StressTestRatePoints" },
                values: new object[] { 600, 650, 20m, 3m });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BureauMinScore",
                table: "LoanProducts");

            migrationBuilder.DropColumn(
                name: "BureauReferScore",
                table: "LoanProducts");

            migrationBuilder.DropColumn(
                name: "MinRemainingIncomePercent",
                table: "LoanProducts");

            migrationBuilder.DropColumn(
                name: "StressTestRatePoints",
                table: "LoanProducts");

            migrationBuilder.DropColumn(
                name: "BureauHasAdverseListing",
                table: "AffordabilityAssessments");

            migrationBuilder.DropColumn(
                name: "BureauOutcome",
                table: "AffordabilityAssessments");

            migrationBuilder.DropColumn(
                name: "BureauReference",
                table: "AffordabilityAssessments");

            migrationBuilder.DropColumn(
                name: "BureauScore",
                table: "AffordabilityAssessments");

            migrationBuilder.DropColumn(
                name: "MinRemainingPassed",
                table: "AffordabilityAssessments");

            migrationBuilder.DropColumn(
                name: "MinRemainingRequired",
                table: "AffordabilityAssessments");

            migrationBuilder.DropColumn(
                name: "OutcomeReasons",
                table: "AffordabilityAssessments");

            migrationBuilder.DropColumn(
                name: "StressTestPassed",
                table: "AffordabilityAssessments");

            migrationBuilder.DropColumn(
                name: "StressedDisposableAfterLoan",
                table: "AffordabilityAssessments");

            migrationBuilder.DropColumn(
                name: "StressedInstallment",
                table: "AffordabilityAssessments");
        }
    }
}
