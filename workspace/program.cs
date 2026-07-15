// Welcome to Koder IDE!
// This is your C# workspace.
// Press 'Run Code' or Ctrl+Enter to execute this file.

using System;

namespace KoderWorkspace
{
    class Program
    {
        static void Main(string[] args)
        {
            Console.WriteLine("Hello from Koder C# Workspace!");

            string developerName = "Developer";
            Console.WriteLine($"Hello, {developerName}! Welcome to Koder, the JS & C# Web IDE.");

            for (int i = 1; i <= 3; i++)
            {
                Console.WriteLine($"Running C# iteration {i}...");
            }
        }
    }
}
