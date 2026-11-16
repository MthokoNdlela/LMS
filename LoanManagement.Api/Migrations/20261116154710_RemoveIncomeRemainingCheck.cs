using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LoanManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class RemoveIncomeRemainingCheck : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MinRemainingIncomePercent",
                table: "LoanProducts");

            migrationBuilder.DropColumn(
                name: "MinRemainingPassed",
                table: "AffordabilityAssessments");

            migrationBuilder.DropColumn(
                name: "MinRemainingRequired",
                table: "AffordabilityAssessments");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "MinRemainingIncomePercent",
                table: "LoanProducts",
                type: "decimal(5,2)",
                precision: 5,
                scale: 2,
                nullable: false,
                defaultValue: 20m);

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

            migrationBuilder.UpdateData(
                table: "LoanProducts",
                keyColumn: "Id",
                keyValue: 1,
                column: "MinRemainingIncomePercent",
                value: 20m);
        }
    }
}
